
const Vs = <typeof import("vscode")>require("vscode");
const Fs = <typeof import("fs")>require("fs");
const Http = <typeof import("http")>require("http");
const Path = <typeof import("path")>require("path");
const Url = <typeof import("url")>require("url");
const Ws = <typeof import("ws")>require("ws");
const PupExtra = <typeof import("puppeteer-extra")>require("puppeteer-extra");
const Pup = PupExtra.default;

const JsParser = <typeof import("recast")>require("recast");
const JsParserUtils = <typeof import("recast/lib/util")>require("recast/lib/util");
const JsBuilder = JsParser.types.builders;

/*
const PupUserPref = require("puppeteer-extra-plugin-user-preferences");

Pup.use(PupUserPref({
	userPrefs: {
    devtools: {
      preferences: {
        'InspectorView.splitViewState': JSON.stringify({
          vertical: {size: 300},
          horizontal: {size: 0},
        }),
        uiTheme: '"dark"',
      }
    }
	}
}));*/

declare module Vs
{
	export type ExtensionContext = import("vscode").ExtensionContext;
	export type Breakpoint = import("vscode").Breakpoint;
	export type TreeDataProvider<T> = import("vscode").TreeDataProvider<T>;
	export type EventEmitter<T> = import("vscode").EventEmitter<T>;
	export type Event<T> = import("vscode").Event<T>;
	export type TreeItem = import("vscode").TreeItem;
	export type TreeItemCollapsibleState = import("vscode").TreeItemCollapsibleState;
	
	export type Command = import("vscode").Command;
	export type TextEditor = import("vscode").TextEditor;
	export type TextDocument = import("vscode").TextDocument;
	export type DecorationOptions = import("vscode").DecorationOptions;
	export type TextEditorDecorationType = import("vscode").TextEditorDecorationType;
	export type Uri = import("vscode").Uri;
	export type OverviewRulerLane = import("vscode").OverviewRulerLane;
	
	export type Task = import("vscode").Task;
	export type TaskProvider = import("vscode").TaskProvider;
	export type TaskDefinition = import("vscode").TaskDefinition;
	export type Pseudoterminal = import("vscode").Pseudoterminal;
	export type TerminalDimensions = import("vscode").TerminalDimensions;
	export type FileSystemWatcher = import("vscode").FileSystemWatcher;
	export type Disposable = import("vscode").Disposable;
	
	export type StatusBarItem = import("vscode").StatusBarItem;
	export type StatusBarAlignment = import("vscode").StatusBarAlignment;
	
	export type Webview = import("vscode").Webview;
	export type WebviewPanel = import("vscode").WebviewPanel;
}

declare module Http
{
	export type Server = import("http").Server;
}

declare module Url
{
	export type UrlWithStringQuery = import("url").UrlWithStringQuery;
}

declare module Ws
{
	export type Server = import("ws").Server;
}

declare module Pup
{
	export type Browser = import("puppeteer").Browser;
	export type BrowserContext = import("puppeteer").BrowserContext;
	export type Page = import("puppeteer").Page;
}

const enum Constants
{
	/**
	 * The prefix that all cover functions must have in their name
	 * in order to be discovered by the moduless cover system.
	 */
	prefix = "cover"
}

const enum Commands
{
	start = "moduless.start",
	stop = "moduless.stop",
	
	startAll = "moduless.startAll",
	
	focusCover = "moduless.focusCover",
	snapshot = "moduless.snapshot",
	openWebView = "moduless.openWebView",
	
	setBrowserVisible = "moduless.set-browser-visible",
	setBrowserInvisible = "moduless.set-browser-invisible",
	
	setDevtoolsVisible = "moduless.set-devtools-visible",
	setDevtoolsInvisible = "moduless.set-devtools-invisible"
}

const enum Contexts
{
	browserVisible = "browserVisible",
	devtoolsVisible = "devtoolsVisible"
}

const enum States
{
	windowMetrics = "windowMetrics",
	isBrowserShown = "isBrowserShown",
	isDevtoolsShown = "isDevtoolsShown"
}

namespace Moduless
{
	export const Common = require("./moduless.common.js");
	Object.assign(Moduless, Common);
}
