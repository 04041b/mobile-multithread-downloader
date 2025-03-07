const fs = require('fs');
const path = require('path');

describe('WebdriverIO interaction and file system check', () => {

    it('should click a button, type in an input field, and check if file exists', async () => {

        // 1. Type text into an input field
        const inputField = await $('#search-input');
        await inputField.waitForExist({ timeout: 5000 });
        await inputField.setValue('https://files.testfile.org/PDF/10MB-TESTFILE.ORG.pdf');

        // 2. Click on a button
        // Wait for the button to be displayed and clickable
        const button = await $('#submit-button');
        await button.waitForClickable({ timeout: 5000 });
        await button.click();



        // 3. Check for a file in the file system
        const filePath = path.join(process.cwd(), 'test_file');

        // Using fs.existsSync to check if the file exists
        const fileExists = fs.existsSync(filePath);

        // Assert that the file exists
        expect(fileExists).toBe(true);

        if (fileExists) {
            console.log(`File exists at: ${filePath}`);

        } else {
            console.log(`File does not exist at: ${filePath}`);
        }
    });
});