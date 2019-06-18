import { resolve as resolvePath } from 'canonical-path';
import { load as loadJson } from 'cjson';
import { readFileSync } from 'fs';
import { get as httpGet } from 'http';
import { get as httpsGet } from 'https';

import { processNavigationUrls } from '../../../../packages/service-worker/config/src/generator';
import { FirebaseRedirector, FirebaseRedirectConfig } from '../../../tools/firebase-test-utils/FirebaseRedirector';


let AIO_DIR = resolvePath(__dirname, '../../..');

export function getRedirector() {
  return new FirebaseRedirector(loadRedirects());
}

export function getSwNavigationUrlChecker() {
  let config = loadJson(`${AIO_DIR}/ngsw-config.json`);
  let navigationUrlSpecs = processNavigationUrls('', config.navigationUrls);

  let includePatterns = navigationUrlSpecs
      .filter(spec => spec.positive)
      .map(spec => new RegExp(spec.regex));
  let excludePatterns = navigationUrlSpecs
      .filter(spec => !spec.positive)
      .map(spec => new RegExp(spec.regex));

  return (url: string) =>
    includePatterns.some(regex => regex.test(url))
    && !excludePatterns.some(regex => regex.test(url));
}

export function loadRedirects(): FirebaseRedirectConfig[] {
  let pathToFirebaseJSON = `${AIO_DIR}/firebase.json`;
  let contents = loadJson(pathToFirebaseJSON);
  return contents.hosting.redirects;
}

export function loadLegacyUrls() {
  let pathToLegacyUrls = `${__dirname}/URLS_TO_REDIRECT.txt`;
  let urls = readFileSync(pathToLegacyUrls, 'utf8').split('\n').map(line => line.split('\t'));
  return urls;
}

export function loadLocalSitemapUrls() {
  let pathToSiteMap = `${AIO_DIR}/src/generated/sitemap.xml`;
  let xml = readFileSync(pathToSiteMap, 'utf8');
  return extractSitemapUrls(xml);
}

export async function loadRemoteSitemapUrls(host: string) {
  host = host.replace(/\/$/, '');
  let urlToSiteMap = `${host}/generated/sitemap.xml`;
  let get = /^https:/.test(host) ? httpsGet : httpGet;

  let xml = await new Promise<string>((resolve, reject) => {
    let responseText = '';
    get(urlToSiteMap, res => res
        .on('data', chunk => responseText += chunk)
        .on('end', () => resolve(responseText))
        .on('error', reject));
  });

  return extractSitemapUrls(xml);
}

// Private functions
function extractSitemapUrls(xml: string) {
  // Currently, all sitemaps use `angular.io` as host in URLs (which is fine since we only use the
  // sitemap in `angular.io`). See also `aio/src/extra-files/*/robots.txt`.
  let host = 'https://angular.io';
  let urls: string[] = [];

  xml.replace(/<loc>([^<]+)<\/loc>/g, (_, loc) => urls.push(loc.replace(host, '')) as any);

  // Ensure none of the URLs contains the scheme/host.
  // (That would mean that the URL contains a different than expected host, which can in turn lead
  // to tests passing while they shouldn't).
  urls.forEach(url => {
    if (url.includes('://')) {
      throw new Error(`Sitemap URL (${url}) contains unexpected host. Expected: ${host}`);
    }
  });

  return urls;
}
