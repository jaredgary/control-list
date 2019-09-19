import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {ClienteService} from '../../servicios/cliente.service';
import {ClienteModel} from '../../model/cliente.model';
import {FlashMessagesService} from 'angular2-flash-messages';
import {NgForm} from '@angular/forms';

@Component({
  selector: 'app-clientes',
  templateUrl: './clientes.component.html',
  styleUrls: ['./clientes.component.css']
})
export class ClientesComponent implements OnInit {

  clients: ClienteModel[];
  client: ClienteModel = {
    nombre: '',
    apellido: '',
    email: '',
    saldo: 0
  };
  @ViewChild('clienteForm', {static: false}) clienteForm: NgForm;
  @ViewChild('botonCerrar', {static: false}) botonCerrar: ElementRef;

  constructor(private clientService: ClienteService,
              private flashMessages: FlashMessagesService) { }

  ngOnInit() {
    this.clientService.getClients().subscribe(
      clients => {
        this.clients = clients;
      }
    );
  }

  getSaldoTotal() {
    let saldo = 0;
    if (this.clients) {
      this.clients.forEach( client => {
        saldo += client.saldo;
      });
    }
    return saldo;
  }

  agregar({value, valid}: {value: ClienteModel, valid: boolean}) {
    if (!valid) {
      this.flashMessages.show('Por favor llena el formulario correctamente', {
        cssClass: 'alert-danger', timeout: 4000
      });
    } else {
      this.clientService.addClient(value);
      this.clienteForm.resetForm();
      this.cerrarModal();
    }
  }

  private cerrarModal() {
    this.botonCerrar.nativeElement.click();
  }

}
