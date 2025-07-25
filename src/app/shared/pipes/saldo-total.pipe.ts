import { Pipe, PipeTransform } from '@angular/core';
import { ClienteModel } from '../../model/cliente.model';

@Pipe({
  name: 'saldoTotal',
  pure: true // Pure pipe for better performance
})
export class SaldoTotalPipe implements PipeTransform {

  transform(clientes: ClienteModel[]): number {
    if (!clientes || !Array.isArray(clientes)) {
      return 0;
    }

    return clientes.reduce((total, cliente) => {
      return total + (cliente.saldo || 0);
    }, 0);
  }
}