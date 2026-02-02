"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var TokenType;
(function (TokenType) {
    TokenType[TokenType["Call"] = 0] = "Call";
    TokenType[TokenType["Var"] = 1] = "Var";
    TokenType[TokenType["Oparen"] = 2] = "Oparen";
    TokenType[TokenType["Value"] = 3] = "Value";
    TokenType[TokenType["Cparen"] = 4] = "Cparen";
})(TokenType || (TokenType = {}));
function tokenize(input) {
    let tokens = [];
    for (let i = 0; i < input.length; i++) {
        let char = input[i];
        if (char == ' ') {
            continue;
        }
        if (char == '(') {
            tokens.push({ val: char, type: TokenType.Oparen });
            continue;
        }
        if (char == ')') {
            tokens.push({ val: char, type: TokenType.Cparen });
            continue;
        }
        if (char >= '0' && char <= '9') {
            let number = '';
            while (i < input.length && (input[i] >= '0' && input[i] <= '9')) {
                number += input[i];
                i++;
            }
            i--;
            tokens.push({ val: number, type: TokenType.Value });
            continue;
        }
        // lowercase letter indicates variable
        if (char >= 'a' && char <= 'z') {
            let varName = '';
            while (i < input.length && ((input[i] >= 'a' && input[i] <= 'z') || (input[i] >= 'A' && input[i] <= 'Z') || (input[i] >= '0' && input[i] <= '9') || input[i] == '_')) {
                varName += input[i];
                i++;
            }
            i--;
            tokens.push({ val: varName, type: TokenType.Var });
            continue;
        }
        // uppercase letter indicates function call
        if (char >= 'A' && char <= 'Z') {
            let callName = '';
            while (i < input.length && ((input[i] >= 'a' && input[i] <= 'z') || (input[i] >= 'A' && input[i] <= 'Z') || (input[i] >= '0' && input[i] <= '9') || input[i] == '_')) {
                callName += input[i];
                i++;
            }
            i--;
            tokens.push({ val: callName, type: TokenType.Call });
            continue;
        }
    }
    return tokens;
}
function constructTree(input) {
    let tokens = tokenize(input);
    let originTree = { value: "root", children: [] };
    let currentTree = originTree;
    for (const token of tokens) {
        if (token.type == TokenType.Call) {
            currentTree.children.push({ value: token.val, children: [] });
            currentTree = currentTree.children[currentTree.children.length - 1];
        }
        if (token.type == TokenType.Var || token.type == TokenType.Value) {
            currentTree.children.push({ value: token.val, children: [] });
        }
        if (token.type == TokenType.Oparen) {
            continue;
        }
        if (token.type == TokenType.Cparen) {
            // move current tree back to parent
            // find parent by traversing from origin
            let path = [originTree];
            let found = false;
            while (path.length > 0 && !found) {
                let node = path.pop();
                for (const child of node.children) {
                    if (child == currentTree) {
                        currentTree = node;
                        found = true;
                        break;
                    }
                    path.push(child);
                }
            }
        }
    }
    return originTree;
}
function printTree(tree, depth = 0) {
    console.log(' '.repeat(depth) + tree.value);
    for (const child of tree.children) {
        printTree(child, depth + 2);
    }
}
const tree = constructTree("Add(Add(n,Constant(1)),Constant(1))");
console.log("Tree structure:");
printTree(tree);
