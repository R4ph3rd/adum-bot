require('dotenv').config();

const puppeteer = require('puppeteer');
const notifier  = require('node-notifier');

const mail     = process.env.MAIL; 
const password = process.env.PASSWORD;
const justificationApplyCourse = 'I want to learn more about this topic and know how to apply this knowledge in my PhD. It is relevant to my subject because I work on XXX.'

//**** Define here the classes you wanna apply to (copy/paste their names) ****/
// DO NOT paste the [Participation présentiel] which is shown in course titles.
const myCourses = [
    'Quantum computers',
    'How to pitch',
    'etc...'
];

// shallow copy of the original array
let coursesList = [...myCourses];


applyToCourses();

async function applyToCourses () {
    // Launch the browser
    const browser = await puppeteer.launch({ headless: false }); // Set to true to run headless
    const page = await browser.newPage();

    // Go to the ADUM login page
    await page.goto('https://adum.fr/index.pl');

    // Se connecter
    
    await page.waitForSelector('input[name="email"]');
    await page.locator('input[name="email"]').fill(mail);
    await page.locator('input[name="password"]').fill(password);
    await page.click('input[name="button_1"]');
    await page.waitForNavigation();
    

    console.log("url 1 :", page.url())

    // Confirm login by checking the URL
    if (page.url() !== 'https://adum.fr/phd/pages/espace_perso.pl') {
        console.error("Failed to log in");
        await browser.close();
        return;
    }

    // Once logged in, click on the 'Catalogue' link under 'Formations'
    await page.click('a[href="/phd/formation/catalogue.pl"]');

    console.log("url 2:", page.url())

    // Wait for the catalogue page to load
    await page.waitForSelector('div#zone_formulaire table a');

    console.log('div zone formulaire table', coursesList);


    // Finds links inside the table within div#zone_formulaire & Extract link texts
    const links = await page.$$('div#zone_formulaire table a');
    const linkTexts = await page.$$eval('div#zone_formulaire table a', anchors => anchors.map(anchor => anchor.textContent));

    for (const course of coursesList) {
        const courseIndex = linkTexts.findIndex(text => text.includes(course));

        console.log('course index', courseIndex);

        if (courseIndex !== -1) {
            console.log('course', course, links[courseIndex]);

            // Go to class page by clicking the corresponding link
            try {
                await links[courseIndex].click();
                await page.waitForNavigation({ waitUntil: 'networkidle0' }); // Wait for navigation to finish

                console.log('url ', page.url());

                if (await await page.$('input[name="button_1"]')){
                    // Click on the 'Demande d'inscription' button
                    await page.click('input[name="button_1"]');
                    await page.waitForNavigation({ waitUntil: 'networkidle0' }); // Wait for the navigation to finish
        
                    // Wait for the textarea to be available and fill it
                    await page.waitForSelector('textarea[name="pkoi"]');
                    await page.locator('textarea[name="pkoi"]').fill(justificationApplyCourse); // Updated selector to textarea
        
                    // Submit the application
                    await page.click('input[name="button_1"]'); // Submit button
                    await page.waitForNavigation({ waitUntil: 'networkidle0' }); // Wait for navigation after submission
        
                    // Confirm login by checking the URL
                    if (page.url().includes('https://adum.fr/phd/formation/formation_inscription.pl')) {
                        console.log("#### You successfully applied to ", course);

                        notifier.notify({
                            title: 'Applying to ADUM',
                            message: 'You successfully applied to the course: ' + course,
                            sound: true, // yey
                        });
                    } else {
                        console.log("Could not apply to ", course);
                    }
                }

                coursesList.splice(coursesList.indexOf(course), 1);
            } catch (error) {
                console.error("Error navigating or interacting with the page:", error);
            }
        }
    }

    if (coursesList.length >= 1){
        notifier.notify({
            title: 'Unsuccesfull applications to ADUM courses',
            message: 'These courses were not avaible to apply: ' + coursesList,
            sound: true, // yey
        });   

        // if not empty, some courses remains to apply, so checks every 3 days
        const dayInMilliseconds = 24 * 60 * 60 * 1000;
        setTimeout(() => {
            applyToCourses();
        }, dayInMilliseconds * 3);
    }

    await browser.close();    
}