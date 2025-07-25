import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SaldoTotalPipe } from './pipes/saldo-total.pipe';

@NgModule({
  declarations: [
    SaldoTotalPipe
  ],
  imports: [
    CommonModule
  ],
  exports: [
    SaldoTotalPipe
  ]
})
export class SharedModule { }