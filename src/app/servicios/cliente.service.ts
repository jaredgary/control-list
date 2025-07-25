import { Injectable, OnDestroy } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection, AngularFirestoreDocument } from '@angular/fire/firestore';
import { ClienteModel } from '../model/cliente.model';
import { Observable, BehaviorSubject, throwError, EMPTY, timer } from 'rxjs';
import { 
  map, 
  shareReplay, 
  catchError, 
  retry, 
  retryWhen, 
  delayWhen, 
  take, 
  switchMap,
  tap,
  finalize
} from 'rxjs/operators';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

@Injectable()
export class ClienteService implements OnDestroy {
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_RETRY_ATTEMPTS = 3;
  
  private clientesCollection: AngularFirestoreCollection<ClienteModel>;
  private clienteDoc: AngularFirestoreDocument<ClienteModel>;
  
  // Cache and state management
  private clientesCache: CacheItem<Observable<ClienteModel[]>> | null = null;
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);
  
  // Public observables
  public loading$ = this.loadingSubject.asObservable();
  public error$ = this.errorSubject.asObservable();

  constructor(private db: AngularFirestore) {
    this.clientesCollection = this.db.collection('clientes', ref => 
      ref.orderBy('nombre', 'asc')
    );
  }

  ngOnDestroy(): void {
    this.loadingSubject.complete();
    this.errorSubject.complete();
  }

  /**
   * Obtiene la lista de clientes con caching inteligente
   * @returns Observable<ClienteModel[]>
   */
  getClients(): Observable<ClienteModel[]> {
    // Check cache validity
    if (this.clientesCache && this.isCacheValid(this.clientesCache)) {
      return this.clientesCache.data;
    }

    // Clear previous errors
    this.errorSubject.next(null);
    this.loadingSubject.next(true);

    const clients$ = this.clientesCollection.snapshotChanges().pipe(
      map(cambios => {
        return cambios.map(accion => {
          const datos = accion.payload.doc.data() as ClienteModel;
          datos.id = accion.payload.doc.id;
          return datos;
        });
      }),
      retryWhen(errors => this.getRetryStrategy(errors)),
      catchError(this.handleError('getClients')),
      shareReplay({ bufferSize: 1, refCount: false }),
      tap(() => this.loadingSubject.next(false)),
      finalize(() => this.loadingSubject.next(false))
    );

    // Cache the observable
    this.clientesCache = {
      data: clients$,
      timestamp: Date.now(),
      ttl: this.CACHE_TTL
    };

    return clients$;
  }

  /**
   * Obtiene un cliente específico con optimización
   * @param id - ID del cliente
   * @returns Observable<ClienteModel | null>
   */
  getClient(id: string): Observable<ClienteModel | null> {
    if (!id?.trim()) {
      return throwError('ID de cliente requerido');
    }

    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    this.clienteDoc = this.db.doc<ClienteModel>(`clientes/${id}`);
    
    return this.clienteDoc.snapshotChanges().pipe(
      map(accion => {
        if (!accion.payload.exists) {
          return null;
        }
        const datos = accion.payload.data() as ClienteModel;
        datos.id = accion.payload.id;
        return datos;
      }),
      retryWhen(errors => this.getRetryStrategy(errors)),
      catchError(this.handleError('getClient')),
      tap(() => this.loadingSubject.next(false)),
      finalize(() => this.loadingSubject.next(false))
    );
  }

  /**
   * Añade un nuevo cliente con validación y optimización
   * @param client - Datos del cliente
   * @returns Promise<void>
   */
  async addClient(client: ClienteModel): Promise<void> {
    try {
      this.validateClientData(client);
      this.loadingSubject.next(true);
      this.errorSubject.next(null);

      await this.clientesCollection.add({
        ...client,
        saldo: client.saldo || 0,
        fechaCreacion: new Date()
      });

      // Invalidate cache to force refresh
      this.invalidateCache();
      
    } catch (error) {
      this.handleError('addClient')(error);
      throw error;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Modifica un cliente existente
   * @param client - Datos del cliente a modificar
   * @returns Promise<void>
   */
  async modify(client: ClienteModel): Promise<void> {
    try {
      if (!client.id) {
        throw new Error('ID de cliente requerido para modificar');
      }
      
      this.validateClientData(client);
      this.loadingSubject.next(true);
      this.errorSubject.next(null);

      this.clienteDoc = this.db.doc<ClienteModel>(`clientes/${client.id}`);
      
      const { id, ...clienteData } = client;
      await this.clienteDoc.update({
        ...clienteData,
        fechaModificacion: new Date()
      });

      this.invalidateCache();
      
    } catch (error) {
      this.handleError('modify')(error);
      throw error;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Elimina un cliente
   * @param client - Cliente a eliminar
   * @returns Promise<void>
   */
  async delete(client: ClienteModel): Promise<void> {
    try {
      if (!client.id) {
        throw new Error('ID de cliente requerido para eliminar');
      }

      this.loadingSubject.next(true);
      this.errorSubject.next(null);

      this.clienteDoc = this.db.doc<ClienteModel>(`clientes/${client.id}`);
      await this.clienteDoc.delete();

      this.invalidateCache();
      
    } catch (error) {
      this.handleError('delete')(error);
      throw error;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Calcula el saldo total de todos los clientes
   * Esta función ahora es reactiva y optimizada
   */
  getSaldoTotal(): Observable<number> {
    return this.getClients().pipe(
      map(clients => 
        clients?.reduce((total, client) => total + (client.saldo || 0), 0) || 0
      ),
      shareReplay(1)
    );
  }

  /**
   * Búsqueda de clientes con debounce
   * @param searchTerm - Término de búsqueda
   * @returns Observable<ClienteModel[]>
   */
  searchClients(searchTerm: string): Observable<ClienteModel[]> {
    if (!searchTerm?.trim()) {
      return this.getClients();
    }

    return this.getClients().pipe(
      map(clients => 
        clients.filter(client => 
          client.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          client.apellido?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          client.email?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    );
  }

  // Private helper methods
  private isCacheValid(cacheItem: CacheItem<any>): boolean {
    return Date.now() - cacheItem.timestamp < cacheItem.ttl;
  }

  private invalidateCache(): void {
    this.clientesCache = null;
  }

  private validateClientData(client: ClienteModel): void {
    if (!client.nombre?.trim()) {
      throw new Error('El nombre del cliente es requerido');
    }
    if (!client.apellido?.trim()) {
      throw new Error('El apellido del cliente es requerido');
    }
    if (client.email && !this.isValidEmail(client.email)) {
      throw new Error('El formato del email no es válido');
    }
    if (client.saldo && client.saldo < 0) {
      throw new Error('El saldo no puede ser negativo');
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private getRetryStrategy(errors: Observable<any>) {
    return errors.pipe(
      switchMap((error, index) => {
        if (index >= this.MAX_RETRY_ATTEMPTS) {
          return throwError(error);
        }
        
        // Exponential backoff: 1s, 2s, 4s
        const delayTime = Math.pow(2, index) * 1000;
        return timer(delayTime);
      })
    );
  }

  private handleError(operation: string) {
    return (error: any): Observable<any> => {
      console.error(`${operation} failed:`, error);
      
      const errorMessage = this.getErrorMessage(error);
      this.errorSubject.next(errorMessage);
      
      // Return empty result to let the app continue working
      return EMPTY;
    };
  }

  private getErrorMessage(error: any): string {
    if (error?.code) {
      switch (error.code) {
        case 'permission-denied':
          return 'No tienes permisos para realizar esta operación';
        case 'unavailable':
          return 'Servicio temporalmente no disponible. Intenta más tarde.';
        case 'not-found':
          return 'El documento solicitado no existe';
        default:
          return 'Ha ocurrido un error inesperado';
      }
    }
    return error?.message || 'Error desconocido';
  }
}
