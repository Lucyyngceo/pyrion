"""FLEX droplet burn-time model with uncertainty (numpy + scipy only).

    python -I models/flex_model.py

CLASS B result ("evaluated model"). Never evidence and never a verdict. It describes the 259 FLEX tests of PSI-69 that have a
droplet diameter, an ambient O2 fraction, a pressure and a burn time; it says nothing about other gravity levels and covers two fuels
(methanol, heptane), each modelled separately because the fuel is a regime. Condition records are read from data/conditions/PSI-69.csv.

(a) log(burn_time) = a + n log(d0) + b O2 + c P by OLS, with a seeded percentile bootstrap (2000 resamples) of n.
(b) Gaussian process on log(burn_time), ARD squared-exponential kernel + noise, hyperparameters by marginal likelihood
    (scipy L-BFGS-B, deterministic seeded multi-start); 5-fold CV and two extrapolation tests.
(c) A grid over O2 x pressure at three diameters with mean, sd and inside_training_hull. Outside the hull the mean is NOT reported.
(d) A greedy experiment designer: the 5 conditions that most reduce the total predictive variance over a stated candidate grid.
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

import numpy as np
from scipy.linalg import cho_factor, cho_solve
from scipy.optimize import minimize
from scipy.spatial import Delaunay

sys.dont_write_bytecode = True
REPO = Path(__file__).resolve().parent.parent
SRC = REPO / "data" / "conditions" / "PSI-69.csv"
OUT = REPO / "data" / "derived" / "flex_model.json"
SEED = 20261114
N_BOOT = 2000
Z68, Z95 = 1.0, 1.959963984540054
INPUTS = ["droplet_diameter_initial_mm", "o2_mole_fraction", "pressure_kPa"]


# ------------------------------------------------------------------ data
def load():
    rec = {}
    with SRC.open(encoding="utf-8", newline="") as fh:
        for r in csv.DictReader(fh):
            if r["method"] != "table" or r["status"] != "extracted":
                continue
            rec.setdefault(r["test_id"], {})[r["variable"]] = r["value"]
    need = ["droplet_diameter_initial", "o2_mole_fraction", "pressure", "outcome:burn_time", "fuel"]
    rows = []
    for tid, v in rec.items():
        if all(k in v for k in need):
            rows.append({"test_id": tid, "fuel": v["fuel"], "d0": float(v["droplet_diameter_initial"]), "o2": float(v["o2_mole_fraction"]),
                         "p": float(v["pressure"]), "t": float(v["outcome:burn_time"]), "end": v.get("outcome:test_end", "")})
    out = {}
    for fuel in sorted({r["fuel"] for r in rows}):
        sub = sorted((r for r in rows if r["fuel"] == fuel), key=lambda r: r["test_id"])
        out[fuel] = {"ids": [r["test_id"] for r in sub], "X": np.array([[r["d0"], r["o2"], r["p"]] for r in sub]),
                     "y": np.log(np.array([r["t"] for r in sub])), "end": [r["end"] for r in sub]}
    return out


# ------------------------------------------------------------------ (a) d2-law check
def ols(X, y):
    A = np.column_stack([np.ones(len(y)), X])
    beta, *_ = np.linalg.lstsq(A, y, rcond=None)
    res = y - A @ beta
    r2 = 1 - (res @ res) / ((y - y.mean()) @ (y - y.mean()))
    return beta, float(r2)


def bootstrap_n(Xd, y, rng, col_slice):
    """Percentile bootstrap of the log(d0) coefficient. Xd columns: log d0 (first) then the extra terms."""
    n_obs = len(y)
    est = np.empty(N_BOOT)
    for b in range(N_BOOT):
        idx = rng.integers(0, n_obs, n_obs)
        beta, _ = ols(Xd[idx][:, col_slice], y[idx])
        est[b] = beta[1]
    return float(np.percentile(est, 2.5)), float(np.percentile(est, 97.5))


def d2_check(fuel, d, rng):
    X, y = d["X"], d["y"]
    logd = np.log(X[:, 0])
    full = np.column_stack([logd, X[:, 1], X[:, 2]])
    res = {}
    for name, cols in (("d0_only", [0]), ("d0_o2_pressure", [0, 1, 2])):
        beta, r2 = ols(full[:, cols], y)
        lo, hi = bootstrap_n(full, y, rng, cols)
        res[name] = {"n": round(float(beta[1]), 4), "ci95": [round(lo, 4), round(hi, 4)], "r2": round(r2, 4),
                     "includes_2": bool(lo <= 2 <= hi),
                     "other_coefficients": {} if name == "d0_only" else {"o2_per_unit_fraction": round(float(beta[2]), 4), "pressure_per_kPa": round(float(beta[3]), 6)}}
    # sensitivity: leave out tests that ended in droplet disruption (they did not burn to extinction or burnout)
    keep = np.array([e != "Disruption" for e in d["end"]])
    beta, r2 = ols(full[keep], y[keep])
    lo, hi = bootstrap_n(full[keep], y[keep], rng, [0, 1, 2])
    res["without_disruption_tests"] = {"n_tests": int(keep.sum()), "n": round(float(beta[1]), 4), "ci95": [round(lo, 4), round(hi, 4)],
                                       "includes_2": bool(lo <= 2 <= hi), "r2": round(r2, 4)}
    return res


# ------------------------------------------------------------------ (b) Gaussian process
class GP:
    """ARD squared-exponential kernel + white noise, on standardized inputs and centred targets."""

    def __init__(self, X, y):
        self.mu, self.sd = X.mean(0), X.std(0)
        self.Xs = (X - self.mu) / self.sd
        self.ym = y.mean()
        self.y = y - self.ym

    @staticmethod
    def kern(A, B, ell, sf):
        d = (A[:, None, :] - B[None, :, :]) / ell
        return sf ** 2 * np.exp(-0.5 * (d ** 2).sum(-1))

    def nll(self, theta):
        ell, sf, sn = np.exp(theta[:3]), np.exp(theta[3]), np.exp(theta[4])
        K = self.kern(self.Xs, self.Xs, ell, sf) + (sn ** 2 + 1e-9) * np.eye(len(self.y))
        try:
            c = cho_factor(K, lower=True)
        except np.linalg.LinAlgError:
            return 1e10
        alpha = cho_solve(c, self.y)
        return 0.5 * self.y @ alpha + np.log(np.diag(c[0])).sum() + 0.5 * len(self.y) * np.log(2 * np.pi)

    def fit(self, seed, n_starts=8):
        bounds = [(np.log(0.15), np.log(30))] * 3 + [(np.log(0.05), np.log(5)), (np.log(0.01), np.log(1.5))]
        rng = np.random.default_rng(seed)
        starts = [np.array([0.0, 0.0, 0.0, np.log(self.y.std() + 1e-6), np.log(0.2)])]
        for _ in range(n_starts - 1):
            starts.append(np.array([rng.uniform(lo, hi) for lo, hi in bounds]))
        best = None
        for s in starts:
            r = minimize(self.nll, np.clip(s, [b[0] for b in bounds], [b[1] for b in bounds]), method="L-BFGS-B", bounds=bounds)
            if best is None or r.fun < best.fun:
                best = r
        self.theta = best.x
        self.ell, self.sf, self.sn = np.exp(best.x[:3]), float(np.exp(best.x[3])), float(np.exp(best.x[4]))
        self.nll_value = float(best.fun)
        K = self.kern(self.Xs, self.Xs, self.ell, self.sf) + (self.sn ** 2 + 1e-9) * np.eye(len(self.y))
        self.c = cho_factor(K, lower=True)
        self.alpha = cho_solve(self.c, self.y)
        return self

    def predict(self, X, noise=True):
        Xs = (X - self.mu) / self.sd
        Ks = self.kern(Xs, self.Xs, self.ell, self.sf)
        mean = Ks @ self.alpha + self.ym
        v = cho_solve(self.c, Ks.T)
        var = self.sf ** 2 - (Ks * v.T).sum(1)
        var = np.maximum(var, 1e-12) + (self.sn ** 2 if noise else 0.0)
        return mean, np.sqrt(var)

    def hyper(self):
        return {"length_scales_standardized": dict(zip(INPUTS, np.round(self.ell, 4).tolist())), "signal_sd": round(self.sf, 4),
                "noise_sd": round(self.sn, 4), "negative_log_marginal_likelihood": round(self.nll_value, 3)}


def metrics(y, mean, sd):
    err = y - mean
    return {"n_test": int(len(y)), "rmse_log_burn_time": round(float(np.sqrt((err ** 2).mean())), 4),
            "coverage_68": round(float((np.abs(err) <= Z68 * sd).mean()), 4), "coverage_95": round(float((np.abs(err) <= Z95 * sd).mean()), 4),
            "mean_predictive_sd": round(float(sd.mean()), 4)}


def cv5(X, y, seed):
    rng = np.random.default_rng(seed)
    perm = rng.permutation(len(y))
    folds = np.array_split(perm, 5)
    means, sds = np.empty(len(y)), np.empty(len(y))
    for i, test in enumerate(folds):
        train = np.setdiff1d(perm, test)
        g = GP(X[train], y[train]).fit(seed + i)
        m, s = g.predict(X[test])
        means[test], sds[test] = m, s
    out = metrics(y, means, sds)
    out["baseline_rmse_predict_training_mean"] = round(float(np.sqrt(((y - y.mean()) ** 2).mean())), 4)
    return out


def cluster_out(X, y, seed, col, high, q):
    """Hold out the block with the highest (or lowest) values of one input, so every test point lies outside the training range."""
    thr = np.quantile(X[:, col], q if high else 1 - q)
    test = X[:, col] > thr if high else X[:, col] < thr
    if test.sum() < 5 or (~test).sum() < 20:
        thr = np.quantile(X[:, col], 0.8 if high else 0.2)
        test = X[:, col] > thr if high else X[:, col] < thr
    g = GP(X[~test], y[~test]).fit(seed)
    m, s = g.predict(X[test])
    out = metrics(y[test], m, s)
    out["held_out"] = f"{INPUTS[col]} {'>' if high else '<'} {thr:.4g}"
    out["n_train"] = int((~test).sum())
    out["training_range_of_held_out_input"] = [round(float(X[~test, col].min()), 4), round(float(X[~test, col].max()), 4)]
    out["held_out_range_of_input"] = [round(float(X[test, col].min()), 4), round(float(X[test, col].max()), 4)]
    out["baseline_rmse_predict_training_mean"] = round(float(np.sqrt(((y[test] - y[~test].mean()) ** 2).mean())), 4)
    return out


# ------------------------------------------------------------------ (c) grid and (d) designer
def hull_of(g):
    pts = g.Xs
    try:
        return Delaunay(pts)
    except Exception:
        return None


def inside(h, g, X):
    if h is None:
        return np.zeros(len(X), dtype=bool)
    return h.find_simplex((X - g.mu) / g.sd) >= 0


def grid_output(g, X):
    h = hull_of(g)
    d_levels = [float(np.round(np.percentile(X[:, 0], q), 3)) for q in (25, 50, 75)]
    o2s = np.round(np.arange(0.10, 0.4001, 0.02), 3)
    ps = np.arange(40, 400.1, 30.0)
    out = []
    for d0 in d_levels:
        pts = np.array([[d0, o, p] for o in o2s for p in ps])
        mean, sd = g.predict(pts)
        ins = inside(h, g, pts)
        cells = []
        for k, (d, o, p) in enumerate(pts):
            c = {"o2_mole_fraction": float(o), "pressure_kPa": float(p), "predictive_sd_log": round(float(sd[k]), 4),
                 "inside_training_hull": bool(ins[k])}
            if ins[k]:
                c["mean_log_burn_time"] = round(float(mean[k]), 4)
                c["mean_burn_time_s"] = round(float(np.exp(mean[k])), 3)
            cells.append(c)
        out.append({"droplet_diameter_initial_mm": d0, "cells": cells})
    return out, d_levels


def design(g, X, k=5):
    """Greedy: pick the candidate whose observation most reduces the summed posterior variance of the latent function over the
    same candidate grid (a 6 x 6 x 6 box between the training min and max of each input). Hyperparameters held fixed."""
    axes = [np.linspace(X[:, j].min(), X[:, j].max(), 6) for j in range(3)]
    grid = np.array([[a, b, c] for a in axes[0] for b in axes[1] for c in axes[2]])
    Xs = (grid - g.mu) / g.sd
    Kall = g.kern(np.vstack([Xs, g.Xs]), np.vstack([Xs, g.Xs]), g.ell, g.sf)
    G = len(grid)
    Kgg, Kgt, Ktt = Kall[:G, :G], Kall[:G, G:], Kall[G:, G:] + (g.sn ** 2 + 1e-9) * np.eye(len(g.y))
    C = Kgg - Kgt @ cho_solve(cho_factor(Ktt, lower=True), Kgt.T)  # posterior covariance of the latent function on the grid
    total0 = float(np.trace(C))
    h = hull_of(g)
    picks = []
    for _ in range(k):
        gain = (C ** 2).sum(0) / (np.diag(C) + g.sn ** 2)  # variance reduction summed over the grid for each candidate
        j = int(np.argmax(gain))
        picks.append({"droplet_diameter_initial_mm": round(float(grid[j, 0]), 3), "o2_mole_fraction": round(float(grid[j, 1]), 4),
                      "pressure_kPa": round(float(grid[j, 2]), 2), "variance_reduction": round(float(gain[j]), 4),
                      "inside_training_hull": bool(inside(h, g, grid[j:j + 1])[0]), "predictive_sd_log_before": round(float(np.sqrt(C[j, j] + g.sn ** 2)), 4)})
        C = C - np.outer(C[:, j], C[j, :]) / (C[j, j] + g.sn ** 2)
    total1 = float(np.trace(C))
    return {"candidate_grid": {"points": int(G), "box": {INPUTS[j]: [round(float(axes[j][0]), 4), round(float(axes[j][-1]), 4)] for j in range(3)},
                               "steps_per_input": 6},
            "total_variance_before": round(total0, 4), "total_variance_after_5_picks": round(total1, 4),
            "fraction_removed": round(1 - total1 / total0, 4), "picks": picks}


def main():
    data = load()
    result = {
        "result_class": "B (evaluated model). Never evidence, never a verdict.",
        "what_it_is": "A statistical description of the FLEX droplet tests in PSI-69 with uncertainty. Microgravity droplet tests only; no gravity extrapolation.",
        "source": "data/conditions/PSI-69.csv (method=table, status=extracted): droplet_diameter_initial, o2_mole_fraction, pressure, outcome:burn_time, fuel",
        "seed": SEED, "bootstrap_resamples": N_BOOT,
        "limits": [
            "Two fuels only (methanol, heptane), each modelled separately.",
            "Inputs are droplet diameter, ambient O2 fraction and pressure. The diluent (N2, CO2, He mixtures) and the test end (extinction, disruption, completion) are NOT inputs, although they change the physics; their effect sits in the noise term.",
            "Burn time is the time to the end of the test, which is often extinction or disruption, not burnout: the d2-law exponent need not be 2.",
            "GP uncertainty grows away from data because of the kernel and the spread of the training points; it is not a measurement.",
            "Outside the convex hull of the training inputs no mean is reported."],
        "fuels": {},
    }
    rng = np.random.default_rng(SEED)
    for fuel, d in data.items():
        X, y = d["X"], d["y"]
        g = GP(X, y).fit(SEED)
        grid, d_levels = grid_output(g, X)
        end_counts = {e: d["end"].count(e) for e in sorted(set(d["end"]))}
        result["fuels"][fuel] = {
            "training": {"n_tests": int(len(y)), "test_end_counts": end_counts,
                         "ranges": {INPUTS[j]: [round(float(X[:, j].min()), 4), round(float(X[:, j].max()), 4)] for j in range(3)},
                         "burn_time_s_range": [round(float(np.exp(y.min())), 3), round(float(np.exp(y.max())), 3)]},
            "d2_law_check": d2_check(fuel, d, rng),
            "gp": {"hyperparameters": g.hyper(), "cv_5fold": cv5(X, y, SEED),
                   "extrapolation_tests": {"highest_o2_block": cluster_out(X, y, SEED, 1, True, 0.85),
                                           "lowest_pressure_block": cluster_out(X, y, SEED, 2, False, 0.85)}},
            "grid": {"d0_levels_mm": d_levels, "levels": grid,
                     "note": "mean_* fields exist only where inside_training_hull is true; elsewhere only the predictive sd is given"},
            "experiment_designer": design(g, X),
        }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    for fuel, r in result["fuels"].items():
        a = r["d2_law_check"]
        cv = r["gp"]["cv_5fold"]
        print(fuel, "n =", a["d0_o2_pressure"]["n"], a["d0_o2_pressure"]["ci95"], "| d0 only", a["d0_only"]["n"], a["d0_only"]["ci95"])
        print("  CV rmse", cv["rmse_log_burn_time"], "cov68", cv["coverage_68"], "cov95", cv["coverage_95"], "baseline", cv["baseline_rmse_predict_training_mean"])
        for k, v in r["gp"]["extrapolation_tests"].items():
            print("  ", k, v["held_out"], "n", v["n_test"], "rmse", v["rmse_log_burn_time"], "cov68", v["coverage_68"], "cov95", v["coverage_95"])


if __name__ == "__main__":
    main()
