declare function puppeteerEval(fnString: any[]): void;
type Page = import("puppeteer").Page;

namespace Puppeteer 
{
  /**
   * @internal
   */
  export function send(args?: [(page: Page) => void, ...any[]])
  {
    if (args)
    {
      const fn = args.shift(); 
      puppeteerEval([fn.toString(), ...args]);
    }
  }
  
  export function click(y: number, x: number, e?: any)
  {
    console.log(`x = ${x}, y = ${y}`);
    return [
      (page: Page, x: number, y: number) => page.mouse.click(x, y), 
      x, 
      y
    ];
  }
  
  export function goto(url: string)
  {
    return [
      (page: Page, url: string) => page.goto(url),
      url
    ];
  }
}