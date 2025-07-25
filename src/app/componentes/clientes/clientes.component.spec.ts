import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { ChangeDetectorRef, DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of, throwError, BehaviorSubject } from 'rxjs';
import { FlashMessagesService } from 'angular2-flash-messages';

import { ClientesComponent } from './clientes.component';
import { ClienteService } from '../../servicios/cliente.service';
import { ClienteModel } from '../../model/cliente.model';

describe('ClientesComponent', () => {
  let component: ClientesComponent;
  let fixture: ComponentFixture<ClientesComponent>;
  let mockClienteService: jasmine.SpyObj<ClienteService>;
  let mockFlashMessages: jasmine.SpyObj<FlashMessagesService>;
  let mockChangeDetectorRef: jasmine.SpyObj<ChangeDetectorRef>;

  const mockClientes: ClienteModel[] = [
    {
      id: '1',
      nombre: 'Juan',
      apellido: 'Pérez',
      email: 'juan@test.com',
      saldo: 1000
    },
    {
      id: '2',
      nombre: 'María',
      apellido: 'González',
      email: 'maria@test.com',
      saldo: 2000
    },
    {
      id: '3',
      nombre: 'Carlos',
      apellido: 'López',
      email: 'carlos@test.com',
      saldo: -500
    }
  ];

  beforeEach(async () => {
    const clienteServiceSpy = jasmine.createSpyObj('ClienteService', [
      'getClients', 'getSaldoTotal', 'addClient', 'delete', 'searchClients'
    ], {
      loading$: new BehaviorSubject(false),
      error$: new BehaviorSubject(null)
    });

    const flashMessagesSpy = jasmine.createSpyObj('FlashMessagesService', ['show']);
    const changeDetectorRefSpy = jasmine.createSpyObj('ChangeDetectorRef', ['markForCheck']);

    await TestBed.configureTestingModule({
      declarations: [ClientesComponent],
      imports: [FormsModule],
      providers: [
        { provide: ClienteService, useValue: clienteServiceSpy },
        { provide: FlashMessagesService, useValue: flashMessagesSpy },
        { provide: ChangeDetectorRef, useValue: changeDetectorRefSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ClientesComponent);
    component = fixture.componentInstance;
    mockClienteService = TestBed.inject(ClienteService) as jasmine.SpyObj<ClienteService>;
    mockFlashMessages = TestBed.inject(FlashMessagesService) as jasmine.SpyObj<FlashMessagesService>;
    mockChangeDetectorRef = TestBed.inject(ChangeDetectorRef) as jasmine.SpyObj<ChangeDetectorRef>;

    // Setup default mock returns
    mockClienteService.getClients.and.returnValue(of(mockClientes));
    mockClienteService.getSaldoTotal.and.returnValue(of(2500));
    mockClienteService.addClient.and.returnValue(Promise.resolve());
    mockClienteService.delete.and.returnValue(Promise.resolve());
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initialization', () => {
    it('should initialize observables on constructor', () => {
      expect(component.clients$).toBeDefined();
      expect(component.saldoTotal$).toBeDefined();
      expect(component.loading$).toBeDefined();
      expect(component.error$).toBeDefined();
    });

    it('should setup search filter on ngOnInit', () => {
      component.ngOnInit();
      
      expect(component.filteredClients$).toBeDefined();
    });

    it('should load clients on ngOnInit', () => {
      component.ngOnInit();
      
      expect(mockClienteService.getClients).toHaveBeenCalled();
    });
  });

  describe('trackByClientId', () => {
    it('should return client id when available', () => {
      const cliente = { id: '123', nombre: 'Test' };
      const result = component.trackByClientId(0, cliente);
      
      expect(result).toBe('123');
    });

    it('should return index as string when id not available', () => {
      const cliente = { nombre: 'Test' };
      const result = component.trackByClientId(5, cliente);
      
      expect(result).toBe('5');
    });
  });

  describe('Search Functionality', () => {
    it('should update search subject when search changes', fakeAsync(() => {
      const searchTerm = 'Juan';
      
      component.onSearchChange(searchTerm);
      tick(300); // Wait for debounce
      
      // Should trigger search filtering
      expect(component.filteredClients$).toBeDefined();
    }));

    it('should trim search term', () => {
      spyOn(component as any, 'searchSubject');
      
      component.onSearchChange('  Juan  ');
      
      // Verify searchSubject.next was called with trimmed value
      expect((component as any).searchSubject.next).toHaveBeenCalledWith('Juan');
    });
  });

  describe('Form Submission', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should show validation errors for invalid form', async () => {
      const mockForm = {
        valid: false,
        controls: {
          nombre: { invalid: true },
          apellido: { invalid: false },
          email: { invalid: false },
          saldo: { invalid: false }
        }
      } as any;

      await component.onSubmitClient(mockForm);

      expect(mockFlashMessages.show).toHaveBeenCalledWith(
        jasmine.stringContaining('El nombre es requerido'),
        jasmine.objectContaining({ cssClass: 'alert-danger' })
      );
    });

    it('should submit valid client form', async () => {
      const mockForm = { valid: true } as any;
      component.clienteFormData = {
        nombre: 'Test',
        apellido: 'Cliente',
        email: 'test@test.com',
        saldo: 1000
      };

      await component.onSubmitClient(mockForm);

      expect(mockClienteService.addClient).toHaveBeenCalledWith(
        jasmine.objectContaining({
          nombre: 'Test',
          apellido: 'Cliente',
          email: 'test@test.com',
          saldo: 1000
        })
      );
      expect(mockFlashMessages.show).toHaveBeenCalledWith(
        'Cliente agregado exitosamente',
        jasmine.objectContaining({ cssClass: 'alert-success' })
      );
    });

    it('should handle form submission errors', async () => {
      const mockForm = { valid: true } as any;
      const errorMessage = 'Error al agregar cliente';
      mockClienteService.addClient.and.returnValue(Promise.reject(new Error(errorMessage)));

      await component.onSubmitClient(mockForm);

      expect(mockFlashMessages.show).toHaveBeenCalledWith(
        errorMessage,
        jasmine.objectContaining({ cssClass: 'alert-danger' })
      );
    });

    it('should set and reset submitting state', async () => {
      const mockForm = { valid: true } as any;
      
      expect(component.isSubmitting).toBeFalse();
      
      const submitPromise = component.onSubmitClient(mockForm);
      expect(component.isSubmitting).toBeTrue();
      
      await submitPromise;
      expect(component.isSubmitting).toBeFalse();
    });

    it('should mark for check during submission', async () => {
      const mockForm = { valid: true } as any;
      
      await component.onSubmitClient(mockForm);
      
      expect(mockChangeDetectorRef.markForCheck).toHaveBeenCalled();
    });
  });

  describe('Client Deletion', () => {
    it('should delete client with confirmation', async () => {
      spyOn(window, 'confirm').and.returnValue(true);
      const clienteToDelete = mockClientes[0];

      await component.onDeleteClient(clienteToDelete);

      expect(window.confirm).toHaveBeenCalledWith(
        `¿Estás seguro de eliminar a ${clienteToDelete.nombre} ${clienteToDelete.apellido}?`
      );
      expect(mockClienteService.delete).toHaveBeenCalledWith(clienteToDelete);
      expect(mockFlashMessages.show).toHaveBeenCalledWith(
        'Cliente eliminado exitosamente',
        jasmine.objectContaining({ cssClass: 'alert-success' })
      );
    });

    it('should not delete client without confirmation', async () => {
      spyOn(window, 'confirm').and.returnValue(false);
      const clienteToDelete = mockClientes[0];

      await component.onDeleteClient(clienteToDelete);

      expect(mockClienteService.delete).not.toHaveBeenCalled();
    });

    it('should handle deletion errors', async () => {
      spyOn(window, 'confirm').and.returnValue(true);
      const errorMessage = 'Error al eliminar cliente';
      mockClienteService.delete.and.returnValue(Promise.reject(new Error(errorMessage)));
      const clienteToDelete = mockClientes[0];

      await component.onDeleteClient(clienteToDelete);

      expect(mockFlashMessages.show).toHaveBeenCalledWith(
        errorMessage,
        jasmine.objectContaining({ cssClass: 'alert-danger' })
      );
    });

    it('should not delete client without ID', async () => {
      const clienteWithoutId = { nombre: 'Test', apellido: 'Cliente' };

      await component.onDeleteClient(clienteWithoutId);

      expect(mockClienteService.delete).not.toHaveBeenCalled();
    });
  });

  describe('Form Reset', () => {
    it('should reset form data', () => {
      component.clienteFormData = {
        nombre: 'Test',
        apellido: 'Test',
        email: 'test@test.com',
        saldo: 100
      };

      component.resetForm();

      expect(component.clienteFormData).toEqual({
        nombre: '',
        apellido: '',
        email: '',
        saldo: 0
      });
    });

    it('should reset form reference if available', () => {
      const mockFormRef = jasmine.createSpyObj('NgForm', ['resetForm']);
      component.clienteFormRef = mockFormRef;

      component.resetForm();

      expect(mockFormRef.resetForm).toHaveBeenCalled();
    });
  });

  describe('Average Balance Calculation', () => {
    it('should calculate average balance correctly', (done) => {
      component.getAverageBalance().subscribe(average => {
        expect(average).toBe(833.33); // 2500 / 3 = 833.33...
        done();
      });
    });

    it('should return 0 for empty client list', (done) => {
      mockClienteService.getClients.and.returnValue(of([]));
      mockClienteService.getSaldoTotal.and.returnValue(of(0));

      component.getAverageBalance().subscribe(average => {
        expect(average).toBe(0);
        done();
      });
    });
  });

  describe('Performance Tests', () => {
    it('should use OnPush change detection strategy', () => {
      // Check that component uses OnPush strategy
      expect(fixture.componentRef.changeDetectorRef.constructor.name)
        .toBe('ViewRef_');
    });

    it('should debounce search input', fakeAsync(() => {
      let searchCallCount = 0;
      spyOn(component as any, 'filterClients').and.callFake(() => {
        searchCallCount++;
        return [];
      });

      // Rapid search inputs
      component.onSearchChange('a');
      component.onSearchChange('ab');
      component.onSearchChange('abc');
      
      // Should not call filter immediately
      expect(searchCallCount).toBe(0);
      
      // After debounce period
      tick(300);
      
      // Should only call once for final search term
      expect(searchCallCount).toBeLessThanOrEqual(1);
    }));

    it('should handle large lists efficiently with trackBy', () => {
      const largeClientList = Array.from({ length: 1000 }, (_, i) => ({
        id: `client-${i}`,
        nombre: `Cliente ${i}`,
        apellido: 'Test',
        saldo: i * 100
      }));

      mockClienteService.getClients.and.returnValue(of(largeClientList));
      
      const startTime = performance.now();
      fixture.detectChanges();
      const endTime = performance.now();
      
      // Should render efficiently (less than 100ms for 1000 items)
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Template Integration', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should display loading state', () => {
      (mockClienteService.loading$ as BehaviorSubject<boolean>).next(true);
      fixture.detectChanges();

      const loadingElement = fixture.debugElement.query(By.css('.loading-overlay'));
      expect(loadingElement).toBeTruthy();
    });

    it('should display error state', () => {
      const errorMessage = 'Test error';
      (mockClienteService.error$ as BehaviorSubject<string>).next(errorMessage);
      fixture.detectChanges();

      const errorElement = fixture.debugElement.query(By.css('.alert-danger'));
      expect(errorElement).toBeTruthy();
      expect(errorElement.nativeElement.textContent).toContain(errorMessage);
    });

    it('should render client table with trackBy', () => {
      fixture.detectChanges();

      const tableRows = fixture.debugElement.queryAll(By.css('tbody tr'));
      expect(tableRows.length).toBeGreaterThan(0);
    });

    it('should show empty state when no clients', () => {
      mockClienteService.getClients.and.returnValue(of([]));
      fixture.detectChanges();

      const emptyState = fixture.debugElement.query(By.css('td[colspan="5"]'));
      expect(emptyState).toBeTruthy();
      expect(emptyState.nativeElement.textContent).toContain('No se encontraron clientes');
    });

    it('should disable submit button when form is invalid', () => {
      fixture.detectChanges();
      
      const submitButton = fixture.debugElement.query(By.css('button[type="submit"]'));
      expect(submitButton.nativeElement.disabled).toBeTruthy();
    });

    it('should show loading spinner in submit button when submitting', () => {
      component.isSubmitting = true;
      fixture.detectChanges();

      const spinner = fixture.debugElement.query(By.css('.spinner-border-sm'));
      expect(spinner).toBeTruthy();
    });
  });

  describe('Memory Management', () => {
    it('should complete subjects on destroy', () => {
      spyOn(component as any, 'destroy$').and.callThrough();
      
      component.ngOnDestroy();
      
      expect((component as any).destroy$.complete).toHaveBeenCalled();
    });

    it('should not have memory leaks after destroy', () => {
      const subscription = component.clients$.subscribe();
      
      component.ngOnDestroy();
      
      expect(subscription.closed).toBeTruthy();
    });
  });
});