const https = require('https');
const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '../temp/gpx');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

async function searchTrip(query) {
    return new Promise((resolve, reject) => {
        // ut.no search API
        const url = `https://ut.no/api/search?q=${encodeURIComponent(query)}&type=turforslag`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.documents && json.documents.length > 0) {
                        resolve(json.documents[0].id);
                    } else {
                        resolve(null);
                    }
                } catch(e) {
                    resolve(null);
                }
            });
        }).on('error', reject);
    });
}

async function downloadGpx(tripId, destId) {
    return new Promise((resolve, reject) => {
        const url = `https://ut.no/api/turer/${tripId}/gpx`;
        const filePath = path.join(outputDir, `${destId}.gpx`);
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                console.log(`Failed to download GPX for trip ${tripId} (Status: ${res.statusCode})`);
                resolve(false);
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                fs.writeFileSync(filePath, data);
                console.log(`[OK] Downloaded ${destId}.gpx (UT trip ID: ${tripId})`);
                resolve(true);
            });
        }).on('error', reject);
    });
}

async function main() {
    const targets = [
        { id: 7, name: 'Kubben Mo i Rana' },
        { id: 11, name: 'Sauvasshytta fra Umbukta' },
        { id: 25, name: 'Storhaugen Selfors' }
    ];

    for (const target of targets) {
        console.log(`Searching for: ${target.name}...`);
        const tripId = await searchTrip(target.name);
        if (tripId) {
            console.log(`Found trip ID: ${tripId}, downloading GPX...`);
            await downloadGpx(tripId, target.id);
        } else {
            console.log(`Could not find trip for ${target.name}`);
        }
    }
}

main();