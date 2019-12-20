declare function puppeteerEval(context: string, fnString: any[]): void;
type Page = import("puppeteer").Page;

interface Context
{
  page: Page;
  coverName: string;
  projectPath: string;
  fs: typeof import("fs");
  path: typeof import("path");
}

namespace Puppeteer 
{
  /**
   * @internal
   */
  export function send(contextData: string, args?: [(context: Context) => void, ...any[]])
  {
    if (args)
    {
      const fn = args.shift(); 
      return puppeteerEval(contextData, [fn.toString(), ...args]);
    }
  }
  
  /** */
  export function click(y: number, x: number)
  {
    return [
      (context: Context, x: number, y: number) => context.page.mouse.click(x, y), 
      x, 
      y
    ];
  }
  
  /** */
  export function keyboard(text: string)
  {
    return [
      (context: Context, text: string) => context.page.keyboard.type(text), 
      text
    ];
  }
  
  /** */
  export function hotkey(text: string)
  {
    const splitted = text.split("+").map(v => v.trim());
    return [
      async (context: Context, keys: string[]) => 
      {
        await Promise.all(keys.map(v => context.page.keyboard.down(v)));
        await Promise.all(keys.map(v => context.page.keyboard.up(v)));
      },
      splitted
    ]
  }
  
  /** */
  export function snapshot()
  {
    return [
      async (context: Context) => 
      {
        const PNG = require('pngjs').PNG;
        const ss = PNG.sync.read(await context.page.screenshot());
        await context.fs.promises.writeFile(
          context.path.join(context.projectPath, "../captures", `${context.coverName}.png`)
        , PNG.sync.write(ss));
      } 
    ];
  }
  
  /** */
  export function compareSnapshot()
  {
    return [
      async (context: Context) => 
      {
        const PNG = require('pngjs').PNG;
        const pixelmatch = require('pixelmatch');
        const ss =  PNG.sync.read(await context.page.screenshot({path: undefined}));
        await context.fs.promises.writeFile(
          context.path.join(context.projectPath, "../captures", `${context.coverName}-expected.png`)
        , PNG.sync.write(ss));
        const file =  PNG.sync.read(await context.fs.promises.readFile(
          context.path.join(context.projectPath, "../captures", `${context.coverName}.png`)
        ));
        const {width, height} = ss;
        const diff = new PNG({width, height});
        
        const result = pixelmatch(ss.data, file.data, diff.data, width, height, {threshold: 0.1});
        await context.fs.promises.writeFile(
          context.path.join(context.projectPath, "../captures", `${context.coverName}-diff.png`)
        , PNG.sync.write(diff))
        
        return result === 0;
      } 
    ];
  }
  
  /** */
  export function goto(url: string)
  {
    return [
      (context: Context, url: string) => context.page.goto(url),
      url
    ];
  }
}