import { Component, OnInit } from '@angular/core';
import {ClienteModel} from '../../model/cliente.model';
import {ClienteService} from '../../servicios/cliente.service';
import {FlashMessagesService} from 'angular2-flash-messages';
import {ActivatedRoute, Router} from '@angular/router';

@Component({
  selector: 'app-editar-cliente',
  templateUrl: './editar-cliente.component.html',
  styleUrls: ['./editar-cliente.component.css']
})
export class EditarClienteComponent implements OnInit {

  client: ClienteModel = {
    nombre: '',
    apellido: '',
    email: '',
    saldo: 0
  };
  id: string;

  constructor(private clientService: ClienteService,
              private flashMessages: FlashMessagesService,
              private router: Router,
              private route: ActivatedRoute) { }

  ngOnInit() {
    this.id = this.route.snapshot.params.id;
    this.clientService.getClient(this.id).subscribe(
      cliente => {
        this.client = cliente;
      }
    );
  }

  guardar({value, valid}: {value: ClienteModel, valid: boolean}) {
    if (!valid) {
      this.flashMessages.show('Llena el formulario correctamente', {
        cssClass: 'alert-danger', timeout: 4000
      });
    } else {
      value.id = this.id;
      this.clientService.modify(value);
      this.router.navigate(['/']);
    }
  }

  eliminar() {
    if (confirm('Seguro que deseas eliminar?')) {
      this.clientService.delete(this.client);
      this.router.navigate(['/']);
    }
  }

}
