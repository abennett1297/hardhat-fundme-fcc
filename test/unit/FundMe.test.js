const { assert, expect } = require("chai");
const { deployments, ethers, getNamedAccounts } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

//if local network, then run
!developmentChains.includes(network.name)
    ? describe.skip
    : describe("FundMe", function () {
        let fundMe;
        let deployer;
        let mockV3Aggregator;
        const sendValue = ethers.utils.parseEther("1") //parses ether into the gwei version 1e18
        beforeEach(async function () {
            // deploy our fundMe dontract using Hardhat-deploy
            //gets deployer from getNamedAccounts
            deployer = (await getNamedAccounts()).deployer;
            // can use fixture from deployments object, lets us run anything from deploy folder with tags
            await deployments.fixture(["all"]);
            //getContract will give us the most recent deployed version of FundMe
            fundMe = await ethers.getContract("FundMe", deployer);
            mockV3Aggregator = await ethers.getContract(
                "MockV3Aggregator",
                deployer
            )
        })

        describe("constructor", function () {
            it("sets the aggregator address correctly", async function() {
                const response = await fundMe.getPriceFeed();
                assert.equal(response, mockV3Aggregator.address);
            })
        })

        describe("fund", function() {
            it("Fails if you don't send enough Eth", async function() {
                // can use waffle to see if transaction was failed or reverted
                await expect(fundMe.fund()).to.be.revertedWith("You need to spend more ETH!");
            })
            it("updates the amount funded data structure", async function() {
                await fundMe.fund({ value: sendValue });
                const response = await fundMe.getAddressToAmountFunded(
                    deployer
                )
                assert.equal(response.toString(), sendValue.toString());
            })
            it("adds funder to array of getFunder", async function() {
                await fundMe.fund({ value:sendValue });
                const funder = await fundMe.getFunder(0);
                assert.equal(funder, deployer);
            })
        })

        describe("withdraw", function() {
            beforeEach(async function() {
                //make sure we start with balance in contract
                await fundMe.fund({value:sendValue});
            })

            it("withdraw ETH from a single funder", async function() {
                //arrange (starting balance of contract and deployer address)
                const startingFundMeBalance = await fundMe.provider.getBalance(fundMe.address);
                const startingDeployerBalance = await fundMe.provider.getBalance(deployer);
                //Act
                const transactionResponse = await fundMe.withdraw();
                const transactionReceipt = await transactionResponse.wait(1);
                const {gasUsed, effectiveGasPrice} = transactionReceipt;
                const gasCost = gasUsed.mul(effectiveGasPrice);

                const endingFundMeBalance = await fundMe.provider.getBalance(fundMe.address);
                const endingDeployerBalance = await fundMe.provider.getBalance(deployer);
                //assert
                assert.equal(endingFundMeBalance, 0);
                assert.equal(startingFundMeBalance .add(startingDeployerBalance).toString(), endingDeployerBalance.add(gasCost).toString());
            })
            it("allows us to withdraw with multiple getFunder", async function() {
                const accounts = await ethers.getSigners();
                for(let i = 1; i < 6; i++) {
                    const fundMeConnectedContract = await fundMe.connect(accounts[i]);
                    await fundMeConnectedContract.fund({value:sendValue});
                }
                const startingFundMeBalance = await fundMe.provider.getBalance(fundMe.address);
                const startingDeployerBalance = await fundMe.provider.getBalance(deployer);

                const transactionResponse = await fundMe.withdraw();
                const transactionReceipt = await transactionResponse.wait(1);
                const {gasUsed, effectiveGasPrice} = transactionReceipt;
                const gasCost = gasUsed.mul(effectiveGasPrice);

                const endingFundMeBalance = await fundMe.provider.getBalance(fundMe.address);
                const endingDeployerBalance = await fundMe.provider.getBalance(deployer);

                assert.equal(endingFundMeBalance, 0);
                assert.equal(startingFundMeBalance .add(startingDeployerBalance).toString(), endingDeployerBalance.add(gasCost).toString());

                await expect(fundMe.getFunder(0)).to.be.reverted;
                for( i = 1; i < 6; i++) {
                    assert.equal(await fundMe.getAddressToAmountFunded(accounts[i].address), 0);
                }
            })
            it("Only allows the owner to withdraw", async function() {
                const accounts = await ethers.getSigners();
                const attacker = accounts[1];
                const attackerConnectedContract = await fundMe.connect(attacker);
                await expect(attackerConnectedContract.withdraw()).to.be.reverted;
            })

            it("Cheaper withdraw testing", async function() {
                const accounts = await ethers.getSigners();
                for(let i = 1; i < 6; i++) {
                    const fundMeConnectedContract = await fundMe.connect(accounts[i]);
                    await fundMeConnectedContract.fund({value:sendValue});
                }
                const startingFundMeBalance = await fundMe.provider.getBalance(fundMe.address);
                const startingDeployerBalance = await fundMe.provider.getBalance(deployer);

                const transactionResponse = await fundMe.cheaperWithdraw();
                const transactionReceipt = await transactionResponse.wait(1);
                const {gasUsed, effectiveGasPrice} = transactionReceipt;
                const gasCost = gasUsed.mul(effectiveGasPrice);

                const endingFundMeBalance = await fundMe.provider.getBalance(fundMe.address);
                const endingDeployerBalance = await fundMe.provider.getBalance(deployer);

                assert.equal(endingFundMeBalance, 0);
                assert.equal(startingFundMeBalance .add(startingDeployerBalance).toString(), endingDeployerBalance.add(gasCost).toString());

                await expect(fundMe.getFunder(0)).to.be.reverted;
                for( i = 1; i < 6; i++) {
                    assert.equal(await fundMe.getAddressToAmountFunded(accounts[i].address), 0);
                }
            })
        })

})