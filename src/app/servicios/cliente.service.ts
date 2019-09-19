import {Injectable} from '@angular/core';
import {AngularFirestore, AngularFirestoreCollection, AngularFirestoreDocument} from '@angular/fire/firestore';
import {ClienteModel} from '../model/cliente.model';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';

@Injectable()
export class ClienteService {
  clientesCollection: AngularFirestoreCollection<ClienteModel>;
  clienteDoc: AngularFirestoreDocument<ClienteModel>;
  clientes: Observable<ClienteModel[]>;
  cliente: Observable<ClienteModel>;

  constructor(private db: AngularFirestore) {
    this.clientesCollection = db.collection('clientes', ref => ref.orderBy('nombre', 'asc') );
  }

  getClients(): Observable<ClienteModel[]> {
    this.clientes = this.clientesCollection.snapshotChanges().pipe(
      map( cambios => {
        return cambios.map( accion => {
          const datos = accion.payload.doc.data() as ClienteModel;
          datos.id = accion.payload.doc.id;
          return datos;
        });
      })
    );
    return this.clientes;
  }

  addClient(client: ClienteModel) {
    this.clientesCollection.add(client);
  }

  getClient(id: string) {
    this.clienteDoc = this.db.doc<ClienteModel>(`clientes/${id}`);
    this.cliente = this.clienteDoc.snapshotChanges().pipe(
      map( accion => {
        if (accion.payload.exists === false) {
          return null;
        } else {
          const datos = accion.payload.data() as ClienteModel;
          datos.id = accion.payload.id;
          return datos;
        }
      })
    );
    return this.cliente;
  }

  modify(client: ClienteModel) {
    this.clienteDoc = this.db.doc<ClienteModel>(`clientes/${client.id}`);
    this.clienteDoc.update(client);
  }

  delete(client: ClienteModel) {
    this.clienteDoc = this.db.doc<ClienteModel>(`clientes/${client.id}`);
    this.clienteDoc.delete();
  }

}
