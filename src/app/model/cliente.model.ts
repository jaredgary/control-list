export interface ClienteModel {
  id?: string;
  nombre?: string;
  apellido?: string;
  email?: string;
  saldo?: number;
  fechaCreacion?: Date;
  fechaModificacion?: Date;
}

export interface ClienteCreateRequest {
  nombre: string;
  apellido: string;
  email?: string;
  saldo?: number;
}

export interface ClienteUpdateRequest {
  id: string;
  nombre?: string;
  apellido?: string;
  email?: string;
  saldo?: number;
}

// Utility type for client operations
export type ClienteFormData = Omit<ClienteModel, 'id' | 'fechaCreacion' | 'fechaModificacion'>;

// Enum for client status if needed in the future
export enum ClienteStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended'
}
