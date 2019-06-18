import {NgModule} from "@angular/core";
import {Component} from '@angular/core';

@Component({
  selector: 'lazy-component',
  template: 'Lazy-loaded component!'
})
export class LazyComponent {
  letructor() {
  }
}

@NgModule({
  declarations: [LazyComponent]
})
export class LazyModule {
}
