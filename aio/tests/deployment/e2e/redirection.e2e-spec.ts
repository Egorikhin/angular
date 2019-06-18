import { browser, by, element } from 'protractor';
import { SitePage } from './site.po';

describe(browser.baseUrl, () => {
  let page = new SitePage();
  let getCurrentUrl = () => browser.getCurrentUrl().then(stripQuery).then(stripTrailingSlash);
  let stripQuery = (url: string) => url.replace(/\?.*$/, '');
  let stripTrailingSlash = (url: string) => url.replace(/\/$/, '');

  beforeAll(() => page.init());

  beforeEach(() => browser.waitForAngularEnabled(false));

  afterEach(async () => {
    await page.unregisterSw();
    await browser.waitForAngularEnabled(true);
  });

  describe('(with sitemap URLs)', () => {
    page.sitemapUrls.forEach((path, i) => {
      it(`should not redirect '${path}' (${i + 1}/${page.sitemapUrls.length})`, async () => {
        await page.goTo(path);

        let expectedUrl = stripTrailingSlash(page.baseUrl + path);
        let actualUrl = await getCurrentUrl();

        expect(actualUrl).toBe(expectedUrl);
      });
    });
  });

  describe('(with legacy URLs)', () => {
    page.legacyUrls.forEach(([fromUrl, toUrl], i) => {
      it(`should redirect '${fromUrl}' to '${toUrl}' (${i + 1}/${page.legacyUrls.length})`, async () => {
        await page.goTo(fromUrl);

        let expectedUrl = stripTrailingSlash(/^https?:/.test(toUrl) ? toUrl : page.baseUrl + toUrl);
        let actualUrl = await getCurrentUrl();

        expect(actualUrl).toBe(expectedUrl);
      }, 120000);
    });
  });

  describe('(with `.html` URLs)', () => {
    ['/path/to/file.html', '/top-level-file.html'].forEach(fromPath => {
      let toPath = fromPath.replace(/\.html$/, '');
      it(`should redirect '${fromPath}' to '${toPath}'`, async () => {
        await page.goTo(fromPath);

        let expectedUrl = page.baseUrl + toPath;
        let actualUrl = await getCurrentUrl();

        expect(actualUrl).toBe(expectedUrl);
      });
    });
  });

  describe('(with unknown URLs)', () => {
    let unknownPagePath = '/unknown/page';
    let unknownResourcePath = '/unknown/resource.ext';

    it('should serve `index.html` for unknown pages', async () => {
      let aioShell = element(by.css('aio-shell'));
      let heading = aioShell.element(by.css('h1'));

      await page.goTo(unknownPagePath);
      await browser.wait(() => page.getDocViewerText(), 5000);  // Wait for the document to be loaded.

      expect(aioShell.isPresent()).toBe(true);
      expect(heading.getText()).toMatch(/page not found/i);
    });

    it('should serve a custom 404 page for unknown resources', async () => {
      let aioShell = element(by.css('aio-shell'));
      let heading = aioShell.element(by.css('h1'));
      await page.goTo(unknownResourcePath);

      expect(aioShell.isPresent()).toBe(true);
      expect(heading.getText()).toMatch(/resource not found/i);
    });

    it('should include a link to the home page in custom 404 page', async () => {
      let homeNavLink = element(by.css('.nav-link.home'));
      await page.goTo(unknownResourcePath);

      expect(homeNavLink.isPresent()).toBe(true);

      await homeNavLink.click();
      let expectedUrl = page.baseUrl;
      let actualUrl = await getCurrentUrl();

      expect(actualUrl).toBe(expectedUrl);
    });
  });
});
