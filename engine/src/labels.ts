// Plain-language names for axes and regime values (used in sentences and reason codes).

const AXIS_LABELS: Readonly<Record<string, string>> = {
  gravity_regime: 'gravity regime',
  fuel_phase: 'fuel phase',
  diluent: 'diluent gas',
  flame_type: 'flame type',
  o2_mole_fraction: 'oxygen',
  burner_o2_mole_fraction: 'burner oxygen',
  pressure: 'pressure',
  flow_velocity: 'flow velocity',
  sample_thickness: 'sample thickness',
  droplet_diameter_initial: 'initial droplet diameter',
  ambient_temperature: 'ambient temperature',
  gravity_level: 'gravity level',
};
const VALUE_LABELS: Readonly<Record<string, string>> = {
  microgravity: 'microgravity',
  partial_gravity: 'partial gravity',
  normal_gravity: 'normal gravity',
  solid: 'solid fuel',
  liquid: 'liquid fuel',
  gas: 'gaseous fuel',
  N2: 'nitrogen',
  He: 'helium',
  CO2: 'carbon dioxide',
  Ar: 'argon',
  mixed: 'mixed gases',
  normal: 'normal flame',
  inverse: 'inverse flame',
};
export const axisLabel = (axis: string): string => AXIS_LABELS[axis] ?? axis.replace(/_/g, ' ');
export const valueLabel = (value: string): string => VALUE_LABELS[value] ?? value;


/** "1 test" / "2 tests": the form that agrees with n. */
export const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);
