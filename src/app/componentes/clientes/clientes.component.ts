import { 
  Component, 
  OnInit, 
  OnDestroy, 
  ChangeDetectionStrategy, 
  ViewChild, 
  ChangeDetectorRef 
} from '@angular/core';
import { NgForm } from '@angular/forms';
import { Observable, Subject, BehaviorSubject, combineLatest } from 'rxjs';
import { 
  takeUntil, 
  map, 
  startWith, 
  debounceTime, 
  distinctUntilChanged,
  finalize,
  tap
} from 'rxjs/operators';

import { ClienteService } from '../../servicios/cliente.service';
import { ClienteModel, ClienteFormData } from '../../model/cliente.model';
import { FlashMessagesService } from 'angular2-flash-messages';

interface ComponentState {
  clients: ClienteModel[];
  filteredClients: ClienteModel[];
  saldoTotal: number;
  loading: boolean;
  error: string | null;
  searchTerm: string;
}

@Component({
  selector: 'app-clientes',
  templateUrl: './clientes.component.html',
  styleUrls: ['./clientes.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientesComponent implements OnInit, OnDestroy {
  
  // Form template reference
  @ViewChild('clienteFormRef', { static: false }) clienteFormRef: NgForm;
  
  // Reactive state management
  private destroy$ = new Subject<void>();
  private searchSubject = new BehaviorSubject<string>('');
  
  // Public observables for template
  public clients$: Observable<ClienteModel[]>;
  public saldoTotal$: Observable<number>;
  public loading$: Observable<boolean>;
  public error$: Observable<string | null>;
  public filteredClients$: Observable<ClienteModel[]>;
  
  // Component state
  public isSubmitting = false;
  public modalId = 'agregarClienteModal';
  
  // Form model
  public clienteFormData: ClienteFormData = {
    nombre: '',
    apellido: '',
    email: '',
    saldo: 0
  };

  constructor(
    private clienteService: ClienteService,
    private flashMessages: FlashMessagesService,
    private cdr: ChangeDetectorRef
  ) {
    this.initializeObservables();
  }

  ngOnInit(): void {
    this.loadClients();
    this.setupSearchFilter();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Track by function for *ngFor optimization
   */
  trackByClientId(index: number, cliente: ClienteModel): string {
    return cliente.id || index.toString();
  }

  /**
   * Handle search input with debounce
   */
  onSearchChange(searchTerm: string): void {
    this.searchSubject.next(searchTerm.trim());
  }

  /**
   * Add new client with proper error handling
   */
  async onSubmitClient(form: NgForm): Promise<void> {
    if (!form.valid) {
      this.showValidationErrors(form);
      return;
    }

    try {
      this.isSubmitting = true;
      this.cdr.markForCheck();

      await this.clienteService.addClient(this.clienteFormData);
      
      this.showSuccessMessage('Cliente agregado exitosamente');
      this.resetForm();
      this.closeModal();
      
    } catch (error) {
      this.showErrorMessage(this.getErrorMessage(error));
    } finally {
      this.isSubmitting = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * Delete client with confirmation
   */
  async onDeleteClient(cliente: ClienteModel): Promise<void> {
    if (!cliente.id) return;

    const confirmed = confirm(`¿Estás seguro de eliminar a ${cliente.nombre} ${cliente.apellido}?`);
    if (!confirmed) return;

    try {
      await this.clienteService.delete(cliente);
      this.showSuccessMessage('Cliente eliminado exitosamente');
    } catch (error) {
      this.showErrorMessage(this.getErrorMessage(error));
    }
  }

  /**
   * Calculate average balance reactively
   */
  getAverageBalance(): Observable<number> {
    return combineLatest([
      this.clients$,
      this.saldoTotal$
    ]).pipe(
      map(([clients, total]) => {
        if (!clients || clients.length === 0) return 0;
        return total / clients.length;
      })
    );
  }

  /**
   * Reset form to initial state
   */
  public resetForm(): void {
    this.clienteFormData = {
      nombre: '',
      apellido: '',
      email: '',
      saldo: 0
    };
    
    if (this.clienteFormRef) {
      this.clienteFormRef.resetForm();
    }
  }

  /**
   * Close modal programmatically
   */
  private closeModal(): void {
    // Use Bootstrap modal API instead of direct DOM manipulation
    const modalElement = document.getElementById(this.modalId);
    if (modalElement) {
      // Assuming Bootstrap 4 is being used
      (window as any).$(`#${this.modalId}`).modal('hide');
    }
  }

  // Private methods for better organization
  private initializeObservables(): void {
    this.clients$ = this.clienteService.getClients();
    this.saldoTotal$ = this.clienteService.getSaldoTotal();
    this.loading$ = this.clienteService.loading$;
    this.error$ = this.clienteService.error$;
  }

  private setupSearchFilter(): void {
    const search$ = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      startWith('')
    );

    this.filteredClients$ = combineLatest([
      this.clients$,
      search$
    ]).pipe(
      map(([clients, searchTerm]) => {
        if (!searchTerm) {
          return clients;
        }
        
        return this.filterClients(clients, searchTerm);
      }),
      takeUntil(this.destroy$)
    );
  }

  private filterClients(clients: ClienteModel[], searchTerm: string): ClienteModel[] {
    const term = searchTerm.toLowerCase();
    
    return clients.filter(cliente => 
      cliente.nombre?.toLowerCase().includes(term) ||
      cliente.apellido?.toLowerCase().includes(term) ||
      cliente.email?.toLowerCase().includes(term) ||
      cliente.saldo?.toString().includes(term)
    );
  }

  private loadClients(): void {
    this.clients$.pipe(
      takeUntil(this.destroy$),
      finalize(() => this.cdr.markForCheck())
    ).subscribe({
      next: (clients) => {
        // Data is handled reactively, no need for manual assignment
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error loading clients:', error);
        this.cdr.markForCheck();
      }
    });
  }

  private showValidationErrors(form: NgForm): void {
    const errors: string[] = [];
    
    if (form.controls['nombre']?.invalid) {
      errors.push('El nombre es requerido');
    }
    if (form.controls['apellido']?.invalid) {
      errors.push('El apellido es requerido');
    }
    if (form.controls['email']?.invalid) {
      errors.push('El email no tiene un formato válido');
    }
    if (form.controls['saldo']?.invalid) {
      errors.push('El saldo debe ser un número válido');
    }

    const message = errors.length > 0 
      ? `Por favor corrige los siguientes errores: ${errors.join(', ')}`
      : 'Por favor llena el formulario correctamente';

    this.showErrorMessage(message);
  }

  private showSuccessMessage(message: string): void {
    this.flashMessages.show(message, {
      cssClass: 'alert-success',
      timeout: 3000
    });
  }

  private showErrorMessage(message: string): void {
    this.flashMessages.show(message, {
      cssClass: 'alert-danger',
      timeout: 5000
    });
  }

  private getErrorMessage(error: any): string {
    if (typeof error === 'string') {
      return error;
    }
    
    return error?.message || 'Ha ocurrido un error inesperado';
  }
}
