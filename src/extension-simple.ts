import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('🎉 SIMPLE EXTENSION ACTIVATED! 🎉');
    vscode.window.showInformationMessage('SIMPLE EXTENSION WORKS!');
    
    // Jednoduchý příkaz
    let disposable = vscode.commands.registerCommand('padak.sayHello', () => {
        vscode.window.showInformationMessage('Padák je super!');
    });
    
    context.subscriptions.push(disposable);
}

export function deactivate() {
    console.log('Extension deactivated');
} 