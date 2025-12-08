
const regex = /(?:^|[\s\(])\$([^$]+)\$$/;
const originalRegex = /\$([^$]+)\$$/;

const testCases = [
    "$x$", 
    " $x$", 
    "($x$)", 
    "Hello $x$", 
    "Hello$x$",
    "Value:$x$",
    "$ x $"
];

console.log("Testing Current Regex:", regex);
testCases.forEach(str => {
    // Tiptap input rule checks match at the END of the string?
    // "find" in InputRule usually matches the text ending at cursor.
    // So 'str' is the text before cursor.
    const match = str.match(regex);
    console.log(`'${str}': ${match ? 'MATCH' : 'NO FAIL'} - Content: ${match ? match[1] : 'N/A'} - Full: '${match ? match[0] : ''}'`);
});

console.log("\nTesting Original Regex:", originalRegex);
testCases.forEach(str => {
    const match = str.match(originalRegex);
    console.log(`'${str}': ${match ? 'MATCH' : 'NO FAIL'} - Content: ${match ? match[1] : 'N/A'} - Full: '${match ? match[0] : ''}'`);
});
