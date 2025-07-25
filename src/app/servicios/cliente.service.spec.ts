import { TestBed } from '@angular/core/testing';
import { AngularFirestore } from '@angular/fire/firestore';
import { of, throwError, timer } from 'rxjs';
import { take } from 'rxjs/operators';

import { ClienteService } from './cliente.service';
import { ClienteModel } from '../model/cliente.model';

describe('ClienteService', () => {
  let service: ClienteService;
  let mockFirestore: jasmine.SpyObj<AngularFirestore>;
  let mockCollection: jasmine.SpyObj<any>;
  let mockDoc: jasmine.SpyObj<any>;

  const mockClientes: ClienteModel[] = [
    {
      id: '1',
      nombre: 'Juan',
      apellido: 'Pérez',
      email: 'juan@test.com',
      saldo: 1000,
      fechaCreacion: new Date('2023-01-01'),
      fechaModificacion: new Date('2023-01-02')
    },
    {
      id: '2',
      nombre: 'María',
      apellido: 'González',
      email: 'maria@test.com',
      saldo: 2000,
      fechaCreacion: new Date('2023-01-03')
    },
    {
      id: '3',
      nombre: 'Carlos',
      apellido: 'López',
      email: 'carlos@test.com',
      saldo: -500,
      fechaCreacion: new Date('2023-01-04')
    }
  ];

  const mockFirestoreChanges = mockClientes.map((cliente, index) => ({
    payload: {
      doc: {
        id: cliente.id,
        data: () => ({ ...cliente, id: undefined })
      }
    }
  }));

  beforeEach(() => {
    const collectionSpy = jasmine.createSpyObj('AngularFirestoreCollection', [
      'snapshotChanges', 'add'
    ]);
    const docSpy = jasmine.createSpyObj('AngularFirestoreDocument', [
      'snapshotChanges', 'update', 'delete'
    ]);
    const firestoreSpy = jasmine.createSpyObj('AngularFirestore', [
      'collection', 'doc'
    ]);

    TestBed.configureTestingModule({
      providers: [
        ClienteService,
        { provide: AngularFirestore, useValue: firestoreSpy }
      ]
    });

    service = TestBed.inject(ClienteService);
    mockFirestore = TestBed.inject(AngularFirestore) as jasmine.SpyObj<AngularFirestore>;
    mockCollection = collectionSpy;
    mockDoc = docSpy;

    // Setup default mock returns
    mockFirestore.collection.and.returnValue(mockCollection);
    mockFirestore.doc.and.returnValue(mockDoc);
    mockCollection.snapshotChanges.and.returnValue(of(mockFirestoreChanges));
    mockDoc.snapshotChanges.and.returnValue(of({
      payload: {
        exists: true,
        id: '1',
        data: () => mockClientes[0]
      }
    }));
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getClients', () => {
    it('should return clients list', (done) => {
      service.getClients().pipe(take(1)).subscribe(clients => {
        expect(clients).toEqual(mockClientes);
        expect(clients.length).toBe(3);
        done();
      });
    });

    it('should cache clients data', (done) => {
      // First call
      service.getClients().pipe(take(1)).subscribe(() => {
        // Second call should use cache
        service.getClients().pipe(take(1)).subscribe(clients => {
          expect(mockCollection.snapshotChanges).toHaveBeenCalledTimes(1);
          expect(clients).toEqual(mockClientes);
          done();
        });
      });
    });

    it('should handle errors with retry strategy', (done) => {
      let attemptCount = 0;
      mockCollection.snapshotChanges.and.callFake(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          return throwError({ code: 'unavailable', message: 'Service unavailable' });
        }
        return of(mockFirestoreChanges);
      });

      service.getClients().pipe(take(1)).subscribe({
        next: (clients) => {
          expect(attemptCount).toBeGreaterThan(2);
          expect(clients).toEqual(mockClientes);
          done();
        },
        error: () => {
          // Should not reach here due to retry
          fail('Should not error with retry strategy');
        }
      });
    });

    it('should emit loading states', (done) => {
      const loadingStates: boolean[] = [];
      
      service.loading$.subscribe(loading => {
        loadingStates.push(loading);
      });

      service.getClients().pipe(take(1)).subscribe(() => {
        // Should have loading states: true, false
        expect(loadingStates).toContain(true);
        expect(loadingStates).toContain(false);
        done();
      });
    });
  });

  describe('getClient', () => {
    it('should return specific client', (done) => {
      service.getClient('1').pipe(take(1)).subscribe(client => {
        expect(client).toEqual(jasmine.objectContaining({
          id: '1',
          nombre: 'Juan',
          apellido: 'Pérez'
        }));
        done();
      });
    });

    it('should return null for non-existent client', (done) => {
      mockDoc.snapshotChanges.and.returnValue(of({
        payload: {
          exists: false
        }
      }));

      service.getClient('999').pipe(take(1)).subscribe(client => {
        expect(client).toBeNull();
        done();
      });
    });

    it('should throw error for empty ID', (done) => {
      service.getClient('').subscribe({
        next: () => fail('Should not succeed with empty ID'),
        error: (error) => {
          expect(error).toBe('ID de cliente requerido');
          done();
        }
      });
    });
  });

  describe('addClient', () => {
    const newClient: ClienteModel = {
      nombre: 'Nuevo',
      apellido: 'Cliente',
      email: 'nuevo@test.com',
      saldo: 500
    };

    it('should add client successfully', async () => {
      mockCollection.add.and.returnValue(Promise.resolve());
      
      await expectAsync(service.addClient(newClient)).toBeResolved();
      
      expect(mockCollection.add).toHaveBeenCalledWith(jasmine.objectContaining({
        nombre: 'Nuevo',
        apellido: 'Cliente',
        email: 'nuevo@test.com',
        saldo: 500,
        fechaCreacion: jasmine.any(Date)
      }));
    });

    it('should validate required fields', async () => {
      const invalidClient = { ...newClient, nombre: '' };
      
      await expectAsync(service.addClient(invalidClient)).toBeRejectedWithError(
        'El nombre del cliente es requerido'
      );
    });

    it('should validate email format', async () => {
      const invalidClient = { ...newClient, email: 'invalid-email' };
      
      await expectAsync(service.addClient(invalidClient)).toBeRejectedWithError(
        'El formato del email no es válido'
      );
    });

    it('should validate negative saldo', async () => {
      const invalidClient = { ...newClient, saldo: -100 };
      
      await expectAsync(service.addClient(invalidClient)).toBeRejectedWithError(
        'El saldo no puede ser negativo'
      );
    });

    it('should invalidate cache after adding', async () => {
      mockCollection.add.and.returnValue(Promise.resolve());
      
      // First call to populate cache
      service.getClients().pipe(take(1)).subscribe();
      
      // Add client (should invalidate cache)
      await service.addClient(newClient);
      
      // Next call should fetch fresh data
      service.getClients().pipe(take(1)).subscribe();
      
      expect(mockCollection.snapshotChanges).toHaveBeenCalledTimes(2);
    });
  });

  describe('modify', () => {
    const clientToModify: ClienteModel = {
      id: '1',
      nombre: 'Juan Modificado',
      apellido: 'Pérez',
      email: 'juan.modificado@test.com',
      saldo: 1500
    };

    it('should modify client successfully', async () => {
      mockDoc.update.and.returnValue(Promise.resolve());
      
      await expectAsync(service.modify(clientToModify)).toBeResolved();
      
      expect(mockDoc.update).toHaveBeenCalledWith(jasmine.objectContaining({
        nombre: 'Juan Modificado',
        apellido: 'Pérez',
        email: 'juan.modificado@test.com',
        saldo: 1500,
        fechaModificacion: jasmine.any(Date)
      }));
    });

    it('should require client ID', async () => {
      const clientWithoutId = { ...clientToModify, id: undefined };
      
      await expectAsync(service.modify(clientWithoutId)).toBeRejectedWithError(
        'ID de cliente requerido para modificar'
      );
    });
  });

  describe('delete', () => {
    const clientToDelete: ClienteModel = { id: '1', nombre: 'Juan', apellido: 'Pérez' };

    it('should delete client successfully', async () => {
      mockDoc.delete.and.returnValue(Promise.resolve());
      
      await expectAsync(service.delete(clientToDelete)).toBeResolved();
      
      expect(mockDoc.delete).toHaveBeenCalled();
    });

    it('should require client ID', async () => {
      const clientWithoutId = { ...clientToDelete, id: undefined };
      
      await expectAsync(service.delete(clientWithoutId)).toBeRejectedWithError(
        'ID de cliente requerido para eliminar'
      );
    });
  });

  describe('getSaldoTotal', () => {
    it('should calculate total balance correctly', (done) => {
      service.getSaldoTotal().pipe(take(1)).subscribe(total => {
        expect(total).toBe(2500); // 1000 + 2000 + (-500)
        done();
      });
    });

    it('should return 0 for empty client list', (done) => {
      mockCollection.snapshotChanges.and.returnValue(of([]));
      
      service.getSaldoTotal().pipe(take(1)).subscribe(total => {
        expect(total).toBe(0);
        done();
      });
    });
  });

  describe('searchClients', () => {
    it('should filter clients by name', (done) => {
      service.searchClients('Juan').pipe(take(1)).subscribe(clients => {
        expect(clients.length).toBe(1);
        expect(clients[0].nombre).toBe('Juan');
        done();
      });
    });

    it('should filter clients by email', (done) => {
      service.searchClients('maria@test.com').pipe(take(1)).subscribe(clients => {
        expect(clients.length).toBe(1);
        expect(clients[0].email).toBe('maria@test.com');
        done();
      });
    });

    it('should return all clients for empty search', (done) => {
      service.searchClients('').pipe(take(1)).subscribe(clients => {
        expect(clients.length).toBe(3);
        done();
      });
    });

    it('should be case insensitive', (done) => {
      service.searchClients('JUAN').pipe(take(1)).subscribe(clients => {
        expect(clients.length).toBe(1);
        expect(clients[0].nombre).toBe('Juan');
        done();
      });
    });
  });

  describe('Performance Tests', () => {
    it('should cache results to avoid duplicate network calls', (done) => {
      const startTime = performance.now();
      
      // First call
      service.getClients().pipe(take(1)).subscribe(() => {
        const firstCallTime = performance.now() - startTime;
        
        const secondStartTime = performance.now();
        
        // Second call (should be cached)
        service.getClients().pipe(take(1)).subscribe(() => {
          const secondCallTime = performance.now() - secondStartTime;
          
          // Cached call should be significantly faster
          expect(secondCallTime).toBeLessThan(firstCallTime);
          expect(mockCollection.snapshotChanges).toHaveBeenCalledTimes(1);
          done();
        });
      });
    });

    it('should handle concurrent requests efficiently', (done) => {
      let completedRequests = 0;
      const totalRequests = 5;
      
      for (let i = 0; i < totalRequests; i++) {
        service.getClients().pipe(take(1)).subscribe(() => {
          completedRequests++;
          if (completedRequests === totalRequests) {
            // Should only make one actual Firebase call due to caching
            expect(mockCollection.snapshotChanges).toHaveBeenCalledTimes(1);
            done();
          }
        });
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle permission-denied error', (done) => {
      mockCollection.snapshotChanges.and.returnValue(
        throwError({ code: 'permission-denied' })
      );

      service.error$.subscribe(error => {
        if (error) {
          expect(error).toBe('No tienes permisos para realizar esta operación');
          done();
        }
      });

      service.getClients().pipe(take(1)).subscribe();
    });

    it('should handle network unavailable error', (done) => {
      mockCollection.snapshotChanges.and.returnValue(
        throwError({ code: 'unavailable' })
      );

      service.error$.subscribe(error => {
        if (error) {
          expect(error).toBe('Servicio temporalmente no disponible. Intenta más tarde.');
          done();
        }
      });

      service.getClients().pipe(take(1)).subscribe();
    });

    it('should handle unknown errors gracefully', (done) => {
      mockCollection.snapshotChanges.and.returnValue(
        throwError({ message: 'Unknown error' })
      );

      service.error$.subscribe(error => {
        if (error) {
          expect(error).toBe('Unknown error');
          done();
        }
      });

      service.getClients().pipe(take(1)).subscribe();
    });
  });
});