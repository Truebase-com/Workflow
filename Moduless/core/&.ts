
const Vs = <typeof import("vscode")>require("vscode");
const Fs = <typeof import("fs")>require("fs");
const Http = <typeof import("http")>require("http");
const Path: typeof import("path") = require("path");
const Url = <typeof import("url")>require("url");
const Ws = <typeof import("ws")>require("ws");

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

const enum Constants
{
	/**
	 * 
	 */
	tryCommand = "moduless.try",
	
	/**
	 * The prefix that all case functions must have in their name
	 * in order to be discovered by the moduless case system.
	 */
	prefix = "case"
}

namespace Moduless
{
	Object.assign(Moduless, require("./moduless.common.js"));
}
