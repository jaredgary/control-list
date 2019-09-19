import {Component, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {LoginService} from '../../servicios/login.service';
import {ConfiguracionService} from '../../servicios/configuracion.service';

@Component({
  selector: 'app-cabecero',
  templateUrl: './cabecero.component.html',
  styleUrls: ['./cabecero.component.css']
})
export class CabeceroComponent implements OnInit {

  isLoggedIn: boolean;
  loggedInUser: string;
  permitirRegistro: boolean;

  constructor(private router: Router,
              private loginService: LoginService,
              private configuracionService: ConfiguracionService) {
  }

  ngOnInit() {
    this.loginService.getAuth().subscribe(auth => {
      if (auth) {
        this.isLoggedIn = true;
        this.loggedInUser = auth.email;
      } else {
        this.isLoggedIn = false;
      }
    });

    this.configuracionService.getConfiguracion().subscribe(
      configuracion => {
        this.permitirRegistro = configuracion.permitirRegistro;
      }
    );
  }

  logout() {
    this.loginService.logout();
    this.isLoggedIn = false;
    this.router.navigate(['/login']);
  }

}
