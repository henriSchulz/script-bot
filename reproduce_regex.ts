
const html = `<p>Bode-Normalform</p><p>Für <strong>Aufgabe 13a</…ta = -\\frac{\\text{Re}(s_0)}{|s_0|}$</p></li></ul>`;
const html2 = `...$</p></li></ul>`;

console.log("Testing regex on:", html);

const processMath = (str: string) => str.replace(/\$([^$]+)\$/g, (match, content) => {
    console.log("Found math:", content);
    return `<span data-type="inline-math" data-content="${content}"></span>`;
});

console.log("Result:", processMath(html));

const test2 = "This is $x$ math.";
console.log("Test 2:", processMath(test2));

const test3 = "Math with backslash: $\\pm 20$ dB.";
console.log("Test 3:", processMath(test3));

const test4 = "Multiple: $x$ and $y$.";
console.log("Test 4:", processMath(test4));

const test5 = "Multiline: $x\n+ y$.";
console.log("Test 5:", processMath(test5));
