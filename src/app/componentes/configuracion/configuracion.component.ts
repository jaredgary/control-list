import {Component, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {ConfiguracionService} from '../../servicios/configuracion.service';
import {Configuracion} from '../../model/configuracion.model';

@Component({
  selector: 'app-configuracion',
  templateUrl: './configuracion.component.html',
  styleUrls: ['./configuracion.component.css']
})
export class ConfiguracionComponent implements OnInit {

  permitirRegistro = false;

  constructor(private router: Router,
              private configuracionService: ConfiguracionService) {
  }

  ngOnInit() {
    this.configuracionService.getConfiguracion().subscribe(
      (configuracion: Configuracion) => {
        this.permitirRegistro = configuracion.permitirRegistro;
      }
    );
  }

  guardar() {
    const configuracion = {permitirRegistro: this.permitirRegistro};
    this.configuracionService.modificarConfiguracion(configuracion);
    this.router.navigate(['/']);
  }

}
