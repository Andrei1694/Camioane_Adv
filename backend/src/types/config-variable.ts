export interface ConfigVariableInput {
  name: string;
  value: string;
  description: string;
}

export interface ConfigVariableUpdate extends ConfigVariableInput {
  version: number;
}
