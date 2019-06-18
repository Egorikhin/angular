import {platformBrowser} from '@angular/platform-browser';
import {AppModuleNgFactory} from './app.ngfactory';

platformBrowser().bootstrapModuleFactory(AppModuleNgFactory, {ngZone: 'noop'});

let input = document.querySelector('input');
let helloWorld = document.querySelector('hello-world-el');
if(input && helloWorld){
  input.addEventListener('input', () => helloWorld.setAttribute('name', input.value));
}
