# luckaward
calculate your power

1.Your computer needs a node environment

// Choose one of the following methods
2.1 download all the transfer transaction from BscScan, https://www.bscscan.com/exportData?type=addresstokentxns&a=0x90740fe48a9DFF923F700b8a45370F9909a37A01
Rename the file you downloaded to transferEvents.csv, Put the file in the current directory.
2.2 Or modify the variable 'LOAD_ALL_TRANSFER_EVENT_FROM' to 'BSC', the program will scan the transfer event from BSC, but it takes more time

3. Add two variables generated after the lottery event ends, Will be generated during live broadcast.

4.run the command 'node calYourPower.js', 
The computing power of all users participating in the lottery will be generated in luckAwardResult.csv.
Sort by computing power from high to low.


