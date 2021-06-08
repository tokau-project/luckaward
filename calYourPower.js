var Web3 = require('web3');
const path = require('path');
const BN = require('bn.js');
const { Parser } = require('json2csv');
const fs = require('fs');
const csv = require('csvtojson');


/**You only need to modify the following two */
/** please Fill in the prices separated by commas*/
var BAKERY_STRING = "835788";
var COIN_PRICE_STRING = "4248543928";

//optional: "BSC" or "CsvFile"
// if CsvFile you must download all the transferEvent csv from BSC Scan
// download url: https://www.bscscan.com/address/0x90740fe48a9DFF923F700b8a45370F9909a37A01#tokentxns
// Rename the file you downloaded to transferEvents.csv
var LOAD_ALL_TRANSFER_EVENT_FROM = "CsvFile"; // "BSC" or "CsvFile"
var CSV_FILE_PATH = "./transferEvents.csv";
/** please Fill in the prices separated by commas*/


const START_BLOCK_NUMBER = 8036931;
const BATCH_BLOCK_COUNT = 1000;
const NET_URL = 'https://bsc-dataseed.binance.org';
const SCORE_ARRAY = [0, 1, 4, 9, 16];

const ERC20_TOKEN_ABI_FILE_PATH = './ERC20_TOKEN_ABI.json';
const TOKAU_CONTRACT_ADDRESS = "0xC409eC8a33f31437Ed753C82EEd3c5F16d6D7e22";
const BUSD_CONTRACT_ADDRESS = "0xe9e7cea3dedca5984780bafc599bd69add087d56";
const BUSDT_CONTRACT_ADDRESS = "0x55d398326f99059ff775485246999027b3197955";
var { abi: ERC20_ABI } = require(path.resolve(__dirname, ERC20_TOKEN_ABI_FILE_PATH));
const PAYMENT_ADDRESS = "0x90740fe48a9DFF923F700b8a45370F9909a37A01";
const TIERED_PRICE = {
    "TOKAU": "3000000",
    "BUSD": "1",
    "BUSD-T": "1",
};
const CONTRACT_ADDRESS_TOKEN_SYMBOL_MAP = new Map();
function initMap() {
    CONTRACT_ADDRESS_TOKEN_SYMBOL_MAP.set(TOKAU_CONTRACT_ADDRESS.toLocaleLowerCase(), "TOKAU");
    CONTRACT_ADDRESS_TOKEN_SYMBOL_MAP.set(BUSD_CONTRACT_ADDRESS.toLocaleLowerCase(), "BUSD");
    CONTRACT_ADDRESS_TOKEN_SYMBOL_MAP.set(BUSDT_CONTRACT_ADDRESS.toLocaleLowerCase(), "BUSD-T");
}
initMap();

// ------- *** load all the transfer events from bsc chain *** --------
async function loadAllEventFromBSC() {
    const web3 = new Web3(new Web3.providers.HttpProvider(NET_URL));
    let events = [];
    let newestBlockNumber = await web3.eth.getBlockNumber();
    console.log('newest block number: ', newestBlockNumber);
    var TOKAU_CONTRACT = new web3.eth.Contract(ERC20_ABI, TOKAU_CONTRACT_ADDRESS);
    var BUSD_CONTRACT = new web3.eth.Contract(ERC20_ABI, BUSD_CONTRACT_ADDRESS);
    var BUSDT_CONTRACT = new web3.eth.Contract(ERC20_ABI, BUSDT_CONTRACT_ADDRESS);
    let startBlockNumber = START_BLOCK_NUMBER;
    let breakFlag = 0;
    while (startBlockNumber < newestBlockNumber) {
        let toBlockNumber = startBlockNumber + BATCH_BLOCK_COUNT;
        if (toBlockNumber >= newestBlockNumber) {
            toBlockNumber = startBlockNumber;
        }
        //tokau
        await readEventFromContract(TOKAU_CONTRACT, events, startBlockNumber, toBlockNumber);
        //busd
        await readEventFromContract(BUSD_CONTRACT, events, startBlockNumber, toBlockNumber);
        //busd-t
        await readEventFromContract(BUSDT_CONTRACT, events, startBlockNumber, toBlockNumber);
        startBlockNumber += BATCH_BLOCK_COUNT;
        console.log(`curr reach block number: ${startBlockNumber}, left block count: ${newestBlockNumber - startBlockNumber}, have done percentage: ${((startBlockNumber - START_BLOCK_NUMBER) / (newestBlockNumber - START_BLOCK_NUMBER) * 100).toFixed(2)}%`);
        breakFlag++;
        if (breakFlag >= 1) {
            break;
        }

    }
    return events;
}

async function readEventFromContract(contract, events, fromBlock, toBlock) {
    let tmpEvents = await contract.getPastEvents('Transfer', {
        fromBlock: fromBlock,
        toBlock: toBlock
    });
    //console.log('tmpEvents: ', tmpEvents);
    if (tmpEvents && tmpEvents.length >= 1) {
        for (let i = 0; i < tmpEvents.length; i++) {
            if (tmpEvents[i]['returnValues']['to'] == PAYMENT_ADDRESS) {
                events.push(tmpEvents[i]);
            }
        }
    }
}

async function getUserAddressEachERC20TokenAmountMap() {
    if (LOAD_ALL_TRANSFER_EVENT_FROM == "BSC") {
        return getUserAddressEachERC20TokenAmountMapByBSC();
    } else {
        return getUserAddressEachERC20TokenAmountMapByCsv();
    }
}

async function getUserAddressEachERC20TokenAmountMapByCsv() {
    let map = new Map();
    try {
        const filePath = path.resolve(__dirname, CSV_FILE_PATH);
        let json = await csv().fromFile(filePath);
        for (let i = 0; i < json.length; i++) {
            let item = json[i];
            if (!map.has(item['From'])) {
                map.set(item['From'], {
                    "TOKAU": "0",
                    "BUSD": "0",
                    "BUSD-T": "0",
                });
            }
            let userTokenAmount = map.get(item['From']);
            let contractAddress = item['ContractAddress'];
            let tokenSymbol = CONTRACT_ADDRESS_TOKEN_SYMBOL_MAP.get(contractAddress.toLowerCase());
            let amount = item['Value'].replace(/[,]/g, "");
            if (amount.indexOf(".") != -1) {
                amount = amount.substring(0, amount.indexOf("."));
            }
            console.log(`tokenSymbol: ${tokenSymbol}, amount: ${amount}`)
            userTokenAmount[tokenSymbol] = new BN(userTokenAmount[tokenSymbol]).add(new BN(amount)).toString();
        }
    } catch (err) {
        console.log('read file CSV_FILE_PATH err: ', err);
        process.exit();
    }
    return map;
}

/**
 * struct
 * {
 *  "userAddress_1": {
 *      "TOKAU": "1000",
 *      "USDT": "100"
 *  }
 * }
 */
async function getUserAddressEachERC20TokenAmountMapByBSC() {
    let map = new Map();
    let events = await loadAllEventFromBSC();
    console.log('total transfer count: ', events.length);
    let uniqueEventAddress = new Set();
    for (let i = 0; i < events.length; i++) {
        if (i == 20) {
            console.log('event: ', events[i]);
        }
        uniqueEventAddress.add(events[i]['address']);
        let item = events[i]['returnValues'];
        if (!map.has(item['from'])) {
            map.set(item['from'], {
                "TOKAU": "0",
                "BUSD": "0",
                "BUSD-T": "0",
            });
        }
        let userTokenAmount = map.get(item['from']);
        let contractAddress = events[i]['address'];
        let tokenSymbol = CONTRACT_ADDRESS_TOKEN_SYMBOL_MAP.get(contractAddress.toLowerCase());
        userTokenAmount[tokenSymbol] = new BN(userTokenAmount[tokenSymbol]).add(new BN(item['value'])).toString();
    }
    console.log('unique event address set: ', uniqueEventAddress);
    return map;
}

calAllUserPowerToCsv();

/**
 * 
 * calculate all user's power write to csv
 */
async function calAllUserPowerToCsv() {
    let map = await getUserAddressEachERC20TokenAmountMap();
    console.log('map: ', map);
    if (map.size < 1) {
        console.log('no data!!!')
        return;
    }
    let allUserPowerArray = [];
    for (let key of map.keys()) {
        let tmpUserPower = await calUserPower(key, map.get(key));
        allUserPowerArray.push(tmpUserPower);
    }
    allUserPowerArray.sort((a, b) => {
        return new BN(b['power']).cmp(new BN(a['power']));
    });
    let fields = ["address", "assets", "result", "power"];
    const parser = new Parser({ fields });
    const csvObj = parser.parse(allUserPowerArray);
    fs.writeFile('./luckAwardResult.csv', csvObj, function (err) {
        if (err) {
            return console.log('write csv file err: ', err);
        }
        console.log('write csv file success');
    })
}

/**
 * calculate one userAddress power
 */
async function calUserPower(userAddress, userAmount) {
    let result = {
        "address": userAddress,
        "assets": userAmount,
        "result": {
            "hit4": 0,
            "hit3": 0,
            "hit2": 0,
            "hit1": 0,
            "hit0": 0,
        },
        "power": 0
    }
    let totalTime = 0;
    for (let key in userAmount) {
        totalTime += calUserTimes(key, userAmount[key]);
    }
    let r = calculateScore(userAddress, totalTime);
    result['result'] = r['result'];
    result['power'] = r['power'];
    return result;
}

/**
 * calculate userAddress number of draws
 * @param {*} tokenSymbol 
 * @param {*} amoumt 
 * @returns 
 */
function calUserTimes(tokenSymbol, amoumt) {
    if (!tokenSymbol in TIERED_PRICE) {
        return 0;
    }
    let price = new BN(TIERED_PRICE[tokenSymbol]);
    let amount = new BN(amoumt.replace(/[,]/g, ''));
    let priceUpTime = 1;
    let time = 0;
    let priceUpCount = 0;
    while (true) {
        amount = amount.sub(new BN(price).mul(new BN(priceUpTime)))
        if (amount.gte(new BN('0'))) {
            time++;
            priceUpCount++;
            if (priceUpCount >= 1000) {
                priceUpCount = 0;
                priceUpTime++;
            }
            if (time >= 4000) {
                break;
            }
        } else {
            break;
        }
    }
    return time;
}

function calculateScore(userAddress, times) {
    let result = {
        "result": {
            "hit4": 0,
            "hit3": 0,
            "hit2": 0,
            "hit1": 0,
            "hit0": 0,
        },
        "power": 0
    };
    if (times < 1) {
        return result;
    }
    for (let i = 0; i < times; i++) {
        let index = calculateHashGetScoreIndex(userAddress, i);
        result['result']['hit' + index]++;
        result['power'] += SCORE_ARRAY[index];
    }
    return result;
}

function calculateHashGetScoreIndex(userAddress, time) {

    let str = BAKERY_STRING + userAddress + COIN_PRICE_STRING + time;
    let hash = Web3.utils.sha3(str).substring(2, 6);
    let count = 0;
    let contractFirstFour = TOKAU_CONTRACT_ADDRESS.substring(2, 6);
    for (let i = 0; i < contractFirstFour.length; i++) {
        if (hash.indexOf(contractFirstFour.charAt(i)) != -1) {
            count++;
        }
    }
    return count;
}




