/**
 * Parser to convert human-readable mathematical notation to Lisp-like notation
 * Examples:
 *   a*b -> Mult(a,b)
 *   a+b -> Add(a,b)
 *   a/b -> Div(a,b)
 *   a-b -> Subtract(a,b)
 *   5 -> Constant(5)
 *   (a+1)*(a+1) -> Mult(Add(a,Constant(1)),Add(a,Constant(1)))
 */

enum HumanTokenType {
    Number,
    Variable,
    Plus,
    Minus,
    Mult,
    Div,
    LParen,
    RParen,
    Comma,
    Identifier,
    Equals
}

type HumanToken = {
    type: HumanTokenType;
    value: string;
};

// Known function names that should be capitalized
const KNOWN_FUNCTIONS = ['sum', 'mult', 'add', 'div', 'subtract', 'constant', 'variable'];

function tokenizeHumanNotation(input: string): HumanToken[] {
    const tokens: HumanToken[] = [];
    let i = 0;

    while (i < input.length) {
        const char = input[i];

        // Skip whitespace
        if (/\s/.test(char)) {
            i++;
            continue;
        }

        // Numbers
        if (/[0-9]/.test(char)) {
            let number = '';
            while (i < input.length && /[0-9]/.test(input[i])) {
                number += input[i];
                i++;
            }
            tokens.push({ type: HumanTokenType.Number, value: number });
            continue;
        }

        // Identifiers (function names or special constructs like Sum, Variable, Constant)
        if (/[A-Z]/.test(char)) {
            let identifier = '';
            while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) {
                identifier += input[i];
                i++;
            }
            tokens.push({ type: HumanTokenType.Identifier, value: identifier });
            continue;
        }

        // Variables (lowercase letters) - but check if it's a known function name
        if (/[a-z]/.test(char)) {
            let variable = '';
            while (i < input.length && /[a-z0-9_]/.test(input[i])) {
                variable += input[i];
                i++;
            }
            
            // Check if this is a known function name
            if (KNOWN_FUNCTIONS.includes(variable.toLowerCase())) {
                // Capitalize first letter
                const capitalized = variable.charAt(0).toUpperCase() + variable.slice(1);
                tokens.push({ type: HumanTokenType.Identifier, value: capitalized });
            } else {
                tokens.push({ type: HumanTokenType.Variable, value: variable });
            }
            continue;
        }

        // Operators and punctuation
        switch (char) {
            case '+':
                tokens.push({ type: HumanTokenType.Plus, value: char });
                i++;
                break;
            case '-':
                tokens.push({ type: HumanTokenType.Minus, value: char });
                i++;
                break;
            case '*':
                tokens.push({ type: HumanTokenType.Mult, value: char });
                i++;
                break;
            case '/':
                tokens.push({ type: HumanTokenType.Div, value: char });
                i++;
                break;
            case '(':
                tokens.push({ type: HumanTokenType.LParen, value: char });
                i++;
                break;
            case ')':
                tokens.push({ type: HumanTokenType.RParen, value: char });
                i++;
                break;
            case ',':
                tokens.push({ type: HumanTokenType.Comma, value: char });
                i++;
                break;
            case '=':
                tokens.push({ type: HumanTokenType.Equals, value: char });
                i++;
                break;
            default:
                throw new Error(`Unexpected character: ${char} at position ${i}`);
        }
    }

    return tokens;
}

class Parser {
    private tokens: HumanToken[];
    private position: number;

    constructor(tokens: HumanToken[]) {
        this.tokens = tokens;
        this.position = 0;
    }

    private peek(): HumanToken | null {
        if (this.position >= this.tokens.length) return null;
        return this.tokens[this.position];
    }

    private consume(): HumanToken {
        if (this.position >= this.tokens.length) {
            throw new Error('Unexpected end of input');
        }
        return this.tokens[this.position++];
    }

    private expect(type: HumanTokenType): HumanToken {
        const token = this.consume();
        if (token.type !== type) {
            throw new Error(`Expected ${HumanTokenType[type]}, got ${HumanTokenType[token.type]}`);
        }
        return token;
    }

    // Parse expression with operator precedence
    // Precedence (lowest to highest): +/-, *, atoms
    public parseExpression(): string {
        return this.parseAdditive();
    }

    private parseAdditive(): string {
        let left = this.parseMultiplicative();

        while (this.peek() && (this.peek()!.type === HumanTokenType.Plus || this.peek()!.type === HumanTokenType.Minus)) {
            const op = this.consume();
            const right = this.parseMultiplicative();
            if (op.type === HumanTokenType.Plus) {
                left = `Add(${left},${right})`;
            } else {
                left = `Subtract(${left},${right})`;
            }
        }

        return left;
    }

    private parseMultiplicative(): string {
        let left = this.parsePrimary();

        while (this.peek() && (this.peek()!.type === HumanTokenType.Mult || this.peek()!.type === HumanTokenType.Div)) {
            const op = this.consume();
            const right = this.parsePrimary();
            if (op.type === HumanTokenType.Mult) {
                left = `Mult(${left},${right})`;
            } else {
                left = `Div(${left},${right})`;
            }
        }

        return left;
    }

    private parsePrimary(): string {
        const token = this.peek();
        if (!token) {
            throw new Error('Unexpected end of input');
        }

        // Number literal
        if (token.type === HumanTokenType.Number) {
            this.consume();
            return `Constant(${token.value})`;
        }

        // Variable
        if (token.type === HumanTokenType.Variable) {
            this.consume();
            return token.value;
        }

        // Function call or special identifier (like Sum, Variable, Constant)
        if (token.type === HumanTokenType.Identifier) {
            this.consume();
            const name = token.value;
            
            // Check if followed by parentheses (function call)
            if (this.peek() && this.peek()!.type === HumanTokenType.LParen) {
                this.expect(HumanTokenType.LParen);
                
                const args: string[] = [];
                
                // Parse arguments
                if (this.peek() && this.peek()!.type !== HumanTokenType.RParen) {
                    args.push(this.parseExpression());
                    
                    while (this.peek() && this.peek()!.type === HumanTokenType.Comma) {
                        this.consume(); // consume comma
                        args.push(this.parseExpression());
                    }
                }
                
                this.expect(HumanTokenType.RParen);
                return `${name}(${args.join(',')})`;
            } else {
                // Just an identifier without parentheses - treat as variable
                return name;
            }
        }

        // Parenthesized expression
        if (token.type === HumanTokenType.LParen) {
            this.consume();
            const expr = this.parseExpression();
            this.expect(HumanTokenType.RParen);
            return expr;
        }

        throw new Error(`Unexpected token: ${HumanTokenType[token.type]}`);
    }
}

/**
 * Convert human-readable mathematical notation to Lisp-like notation
 */
export function humanToLisp(input: string): string {
    const tokens = tokenizeHumanNotation(input);
    const parser = new Parser(tokens);
    return parser.parseExpression();
}

/**
 * Parse an equation (left = right)
 */
export function parseEquation(input: string): string {
    const equalsIndex = input.indexOf('=');
    if (equalsIndex === -1) {
        throw new Error('Equation must contain =');
    }

    const left = input.substring(0, equalsIndex).trim();
    const right = input.substring(equalsIndex + 1).trim();

    const leftLisp = humanToLisp(left);
    const rightLisp = humanToLisp(right);

    return `${leftLisp} = ${rightLisp}`;
}
