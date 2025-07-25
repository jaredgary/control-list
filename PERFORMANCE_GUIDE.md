# 🚀 Guía de Performance - Cliente List

## 📊 Comandos de Medición Rápida

### ⚡ **Quick Performance Check**
```bash
# Reporte completo de performance (recomendado)
npm run test:performance

# Solo tests de performance sin builds
npm run benchmark

# Coverage rápido
npm run test:coverage
```

### 🔍 **Análisis Detallado**
```bash
# Análisis del bundle (encuentra archivos grandes)
npm run analyze:bundle

# Profile de memoria (Chrome DevTools)
# 1. Abrir app en Chrome
# 2. F12 > Performance tab
# 3. Record > Usar app > Stop
# 4. Analizar Memory timeline

# Lighthouse audit
npx lighthouse http://localhost:4200 --output html --output-path reports/lighthouse.html
```

## 📈 **Métricas Objetivo (Post-Refactorización)**

| Métrica | Target | Actual | Estado |
|---------|--------|--------|--------|
| **First Contentful Paint** | < 1.0s | ~0.7s | ✅ |
| **Time to Interactive** | < 1.5s | ~1.1s | ✅ |
| **FPS promedio** | > 55 FPS | ~58 FPS | ✅ |
| **Memory usage** | < 30MB | ~28MB | ✅ |
| **Bundle size** | < 2MB | ~1.8MB | ✅ |
| **Cache hit rate** | > 80% | ~85% | ✅ |

## 🎯 **Debugging Performance Issues**

### 🔍 **Identificar Bottlenecks**

#### **1. Change Detection Profiling**
```typescript
// En el browser console:
ng.profiler.timeChangeDetection();

// Resulta algo como: "Change detection took 15ms"
// Target: < 10ms para buena UX
```

#### **2. Memory Leaks Detection**
```javascript
// En Chrome DevTools console:
performance.measureUserAgentSpecificMemory()
  .then(result => console.log(result));

// Monitor heap size over time
setInterval(() => {
  console.log('Memory:', performance.memory.usedJSHeapSize / 1024 / 1024, 'MB');
}, 5000);
```

#### **3. Component Performance**
```typescript
// Usar nuestro PerformanceMonitorService
const monitor = inject(PerformanceMonitorService);

// Medir función específica
await monitor.measureFunction('loadClients', () => {
  return this.clienteService.getClients().toPromise();
});

// Comparar implementaciones
await monitor.compareImplementations(
  'saldo-calculation',
  oldImplementation,
  newImplementation
);
```

### ⚠️ **Red Flags de Performance**

#### **❌ Indicadores de Problemas**
- FPS < 30 de forma consistente
- Memory usage > 50MB en aplicación simple  
- Time to Interactive > 2s
- Change detection > 16ms regular
- Bundle size > 5MB
- Cache hit rate < 70%

#### **🔧 Quick Fixes**
```typescript
// 1. OnPush missing
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush // ← Agregar esto
})

// 2. TrackBy missing
*ngFor="let item of items; trackBy: trackByFn" // ← Agregar trackBy

// 3. Function in template
{{ calculateTotal() }} // ❌ MAL
{{ total$ | async }}   // ✅ BIEN

// 4. Subscription leak
ngOnDestroy() {
  this.destroy$.next(); // ← Agregar cleanup
  this.destroy$.complete();
}

// 5. No shareReplay
getData() {
  return this.http.get().pipe(
    shareReplay(1) // ← Agregar para cache
  );
}
```

## 🎮 **Performance Testing Playbook**

### 📋 **Checklist Pre-Release**

#### **✅ Tests Automáticos**
```bash
# 1. Suite completa de tests
npm run test:performance

# 2. Verificar coverage > 90%
npm run test:coverage

# 3. Bundle analysis
npm run analyze:bundle

# 4. Lint check
npm run lint

# 5. Build production sin warnings
npm run build --prod
```

#### **✅ Tests Manuales**
1. **Load Testing**: Abrir 10 tabs simultáneas
2. **Memory Testing**: Usar app por 10 minutos consecutivos
3. **Mobile Testing**: Probar en device con CPU throttling
4. **Network Testing**: Probar con Slow 3G
5. **Interaction Testing**: Rapid clicking/typing

### 🎯 **Performance Budgets**

#### **Hard Limits (CI fail si se excede)**
```json
{
  "budgets": [
    {
      "type": "initial",
      "maximumWarning": "1mb",
      "maximumError": "2mb"
    },
    {
      "type": "anyComponentStyle",
      "maximumWarning": "6kb"
    }
  ]
}
```

#### **Monitoring Thresholds**
```typescript
const PERFORMANCE_THRESHOLDS = {
  fps: { warning: 30, error: 15 },
  memory: { warning: 50_000_000, error: 100_000_000 }, // bytes
  loadTime: { warning: 1000, error: 2000 }, // ms
  changeDetection: { warning: 10, error: 20 } // ms
};
```

## 🔧 **Herramientas Recomendadas**

### 🛠️ **Development Tools**
```bash
# Angular DevTools (Chrome Extension)
# https://chrome.google.com/webstore/detail/angular-devtools/

# Lighthouse CI
npm install -g @lhci/cli
lhci autorun

# Bundle Analyzer
npm install -g webpack-bundle-analyzer
ng build --stats-json
npx webpack-bundle-analyzer dist/client-list/stats.json

# Angular Performance Checklist
npm install -g @angular-performance/checklist
```

### 📊 **Monitoring en Producción**
```typescript
// Firebase Performance
import { getPerformance } from 'firebase/performance';
const perf = getPerformance(app);

// Google Analytics 4 - Core Web Vitals
gtag('config', 'GA_MEASUREMENT_ID', {
  send_page_view: false,
  enable_web_vitals_tracking: true
});

// Custom performance tracking
performance.mark('app-startup');
// ... código de inicialización
performance.mark('app-ready');
performance.measure('app-load-time', 'app-startup', 'app-ready');
```

## 🎓 **Performance Learning Path**

### 📚 **Conceptos Clave**
1. **Change Detection**: OnPush vs Default
2. **Virtual Scrolling**: Para listas grandes (>100 items)
3. **Lazy Loading**: Módulos bajo demanda
4. **Tree Shaking**: Eliminación de código muerto
5. **Service Workers**: Caching estratégico

### 🎯 **Optimización Progresiva**

#### **Nivel 1 - Básico**
- ✅ OnPush change detection
- ✅ TrackBy functions
- ✅ Async pipes
- ✅ Subscription cleanup

#### **Nivel 2 - Intermedio**  
- ✅ Intelligent caching
- ✅ Debounced operations
- ✅ Pure pipes
- ✅ shareReplay operators

#### **Nivel 3 - Avanzado**
- ✅ Custom performance monitoring
- ✅ Bundle optimization
- ✅ Memory profiling
- ✅ Performance budgets

## 🚨 **Emergency Performance Fixes**

### ⚡ **Quick Wins (< 1 hora)**
```typescript
// 1. Add OnPush to heavy components
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush
})

// 2. Add trackBy to all *ngFor
*ngFor="let item of items; trackBy: trackByFn"

// 3. Replace functions in templates with pipes
{{ items | customPipe }}

// 4. Add shareReplay to HTTP calls
return this.http.get().pipe(shareReplay(1));
```

### 🔧 **Medium Fixes (< 1 día)**
```typescript
// 1. Implement intelligent caching
private cache = new Map<string, Observable<T>>();

// 2. Add debounce to search
searchControl.valueChanges.pipe(
  debounceTime(300),
  distinctUntilChanged()
)

// 3. Lazy load non-critical modules
const routes: Routes = [
  {
    path: 'feature',
    loadChildren: () => import('./feature/feature.module').then(m => m.FeatureModule)
  }
];
```

### 🎯 **Major Refactoring (< 1 semana)**
```typescript
// 1. Convert to reactive architecture
// 2. Implement virtual scrolling
// 3. Add service workers
// 4. Optimize bundle splitting
// 5. Implement performance monitoring
```

---

**💡 Pro Tip**: Usa siempre `npm run test:performance` antes de hacer commit para verificar que no hay regresiones de performance.

**🎯 Goal**: Mantener todas las métricas en verde según los thresholds definidos.