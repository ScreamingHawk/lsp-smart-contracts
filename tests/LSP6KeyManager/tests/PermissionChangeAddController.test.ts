import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

// constants
import {
  ERC725YDataKeys,
  ALL_PERMISSIONS,
  PERMISSIONS,
  INTERFACE_IDS,
} from "../../../constants";

// setup
import { LSP6TestContext } from "../../utils/context";
import { setupKeyManager } from "../../utils/fixtures";

// helpers
import {
  combinePermissions,
  combineAllowedCalls,
  encodeCompactBytesArray,
} from "../../utils/helpers";

export const shouldBehaveLikePermissionChangeOrAddController = (
  buildContext: () => Promise<LSP6TestContext>
) => {
  let context: LSP6TestContext;

  describe("setting permissions keys (CHANGE vs ADD Permissions)", () => {
    let canOnlyAddController: SignerWithAddress,
      canOnlyChangePermissions: SignerWithAddress,
      canOnlySetData: SignerWithAddress,
      // addresses being used to CHANGE (= edit) permissions
      addressToEditPermissions: SignerWithAddress,
      addressWithZeroHexPermissions: SignerWithAddress;

    let permissionArrayKeys: string[] = [];
    let permissionArrayValues: string[] = [];

    beforeEach(async () => {
      context = await buildContext();

      canOnlyAddController = context.accounts[1];
      canOnlyChangePermissions = context.accounts[2];
      canOnlySetData = context.accounts[3];
      addressToEditPermissions = context.accounts[4];
      addressWithZeroHexPermissions = context.accounts[5];

      let permissionKeys = [
        ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
          context.owner.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
          canOnlyAddController.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
          canOnlyChangePermissions.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
          canOnlySetData.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
          addressToEditPermissions.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
          addressWithZeroHexPermissions.address.substring(2),
      ];

      let permissionValues = [
        ALL_PERMISSIONS,
        PERMISSIONS.ADDCONTROLLER,
        PERMISSIONS.CHANGEPERMISSIONS,
        PERMISSIONS.SETDATA,
        // placeholder permission
        PERMISSIONS.TRANSFERVALUE,
        // 0x0000... = similar to empty, or 'no permissions set'
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      ];

      permissionArrayKeys = [
        ERC725YDataKeys.LSP6["AddressPermissions[]"].length,
        ERC725YDataKeys.LSP6["AddressPermissions[]"].index +
          "00000000000000000000000000000000",
        ERC725YDataKeys.LSP6["AddressPermissions[]"].index +
          "00000000000000000000000000000001",
        ERC725YDataKeys.LSP6["AddressPermissions[]"].index +
          "00000000000000000000000000000002",
        ERC725YDataKeys.LSP6["AddressPermissions[]"].index +
          "00000000000000000000000000000003",
        ERC725YDataKeys.LSP6["AddressPermissions[]"].index +
          "00000000000000000000000000000004",
        ERC725YDataKeys.LSP6["AddressPermissions[]"].index +
          "00000000000000000000000000000005",
      ];

      permissionArrayValues = [
        ethers.utils.hexZeroPad(ethers.utils.hexlify(6), 32),
        context.owner.address,
        canOnlyAddController.address,
        canOnlyChangePermissions.address,
        canOnlySetData.address,
        addressToEditPermissions.address,
        addressWithZeroHexPermissions.address,
      ];

      permissionKeys = permissionKeys.concat(permissionArrayKeys);
      permissionValues = permissionValues.concat(permissionArrayValues);

      await setupKeyManager(context, permissionKeys, permissionValues);
    });

    describe("when setting one permission key", () => {
      describe("when caller is an address with ALL PERMISSIONS", () => {
        it("should be allowed to ADD a permission", async () => {
          let newController = ethers.Wallet.createRandom();

          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
            newController.address.substr(2);

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, PERMISSIONS.SETDATA]
          );

          await context.keyManager
            .connect(context.owner)
            ["execute(bytes)"](payload);

          // prettier-ignore
          const result = await context.universalProfile["getData(bytes32)"](key);
          expect(result).to.equal(PERMISSIONS.SETDATA);
        });

        it("should be allowed to CHANGE a permission", async () => {
          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
            addressToEditPermissions.address.substring(2);

          let value = PERMISSIONS.SETDATA;

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await context.keyManager
            .connect(context.owner)
            ["execute(bytes)"](payload);

          // prettier-ignore
          const result = await context.universalProfile["getData(bytes32)"](key);
          expect(result).to.equal(value);
        });

        describe("when editing `AddressPermissions[]` array length", () => {
          it("should be allowed to increment the length", async () => {
            let key = ERC725YDataKeys.LSP6["AddressPermissions[]"].length;
            let value = ethers.utils.hexZeroPad(ethers.utils.hexlify(8), 32);

            let payload = context.universalProfile.interface.encodeFunctionData(
              "setData(bytes32,bytes)",
              [key, value]
            );

            await context.keyManager
              .connect(context.owner)
              ["execute(bytes)"](payload);

            // prettier-ignore
            const result = await context.universalProfile["getData(bytes32)"](key);
            expect(result).to.equal(value);
          });

          it("should be allowed to decrement the length", async () => {
            let key = ERC725YDataKeys.LSP6["AddressPermissions[]"].length;
            let value = ethers.utils.hexZeroPad(ethers.utils.hexlify(4), 32);

            let payload = context.universalProfile.interface.encodeFunctionData(
              "setData(bytes32,bytes)",
              [key, value]
            );

            await context.keyManager
              .connect(context.owner)
              ["execute(bytes)"](payload);

            // prettier-ignore
            const result = await context.universalProfile["getData(bytes32)"](key);
            expect(result).to.equal(value);
          });
        });

        describe("when adding a new address at index -> AddressPermissions[6]", () => {
          it("should be allowed to set a 20 bytes long address", async () => {
            let key =
              ERC725YDataKeys.LSP6["AddressPermissions[]"].index +
              "00000000000000000000000000000006";
            let value = ethers.Wallet.createRandom().address.toLowerCase();

            let payload = context.universalProfile.interface.encodeFunctionData(
              "setData(bytes32,bytes)",
              [key, value]
            );

            await context.keyManager
              .connect(context.owner)
              ["execute(bytes)"](payload);

            const result = await context.universalProfile["getData(bytes32)"](
              key
            );
            expect(result).to.equal(value);
          });

          it("should revert when setting a random 10 bytes value", async () => {
            let key =
              ERC725YDataKeys.LSP6["AddressPermissions[]"].index +
              "00000000000000000000000000000006";
            let randomValue = "0xcafecafecafecafecafe";

            // set some random bytes under AddressPermissions[7]
            let setupPayload =
              context.universalProfile.interface.encodeFunctionData(
                "setData(bytes32,bytes)",
                [key, randomValue]
              );

            await expect(
              context.keyManager
                .connect(context.owner)
                ["execute(bytes)"](setupPayload)
            )
              .to.be.revertedWithCustomError(
                context.keyManager,
                "AddressPermissionArrayIndexValueNotAnAddress"
              )
              .withArgs(key, randomValue);
          });

          it("should revert when setting a random 30 bytes value", async () => {
            let key =
              ERC725YDataKeys.LSP6["AddressPermissions[]"].index +
              "00000000000000000000000000000006";
            let randomValue =
              "0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef";

            // set some random bytes under AddressPermissions[7]
            let setupPayload =
              context.universalProfile.interface.encodeFunctionData(
                "setData(bytes32,bytes)",
                [key, randomValue]
              );

            await expect(
              context.keyManager
                .connect(context.owner)
                ["execute(bytes)"](setupPayload)
            )
              .to.be.revertedWithCustomError(
                context.keyManager,
                "AddressPermissionArrayIndexValueNotAnAddress"
              )
              .withArgs(key, randomValue);
          });
        });

        describe("when editing the value stored at index -> AddressPermissions[4]", () => {
          it("should be allowed to set a new 20 bytes long address", async () => {
            let randomWallet = ethers.Wallet.createRandom();

            let key =
              ERC725YDataKeys.LSP6["AddressPermissions[]"].index +
              "00000000000000000000000000000004";

            let value = randomWallet.address;

            let payload = context.universalProfile.interface.encodeFunctionData(
              "setData(bytes32,bytes)",
              [key, value]
            );

            await context.keyManager
              .connect(context.owner)
              ["execute(bytes)"](payload);

            // prettier-ignore
            const result = await context.universalProfile["getData(bytes32)"](key);
            expect(ethers.utils.getAddress(result)).to.equal(value);
          });

          it("should revert when setting a random 10 bytes value", async () => {
            let key =
              ERC725YDataKeys.LSP6["AddressPermissions[]"].index +
              "00000000000000000000000000000004";
            let randomValue = "0xcafecafecafecafecafe";

            // set some random bytes under AddressPermissions[7]
            let setupPayload =
              context.universalProfile.interface.encodeFunctionData(
                "setData(bytes32,bytes)",
                [key, randomValue]
              );

            await expect(
              context.keyManager
                .connect(context.owner)
                ["execute(bytes)"](setupPayload)
            )
              .to.be.revertedWithCustomError(
                context.keyManager,
                "AddressPermissionArrayIndexValueNotAnAddress"
              )
              .withArgs(key, randomValue);
          });

          it("should revert when setting a random 30 bytes value", async () => {
            let key =
              ERC725YDataKeys.LSP6["AddressPermissions[]"].index +
              "00000000000000000000000000000004";
            let randomValue =
              "0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef";

            // set some random bytes under AddressPermissions[7]
            let setupPayload =
              context.universalProfile.interface.encodeFunctionData(
                "setData(bytes32,bytes)",
                [key, randomValue]
              );

            await expect(
              context.keyManager
                .connect(context.owner)
                ["execute(bytes)"](setupPayload)
            )
              .to.be.revertedWithCustomError(
                context.keyManager,
                "AddressPermissionArrayIndexValueNotAnAddress"
              )
              .withArgs(key, randomValue);
          });
        });

        describe("when removing the address at index -> AddressPermissions[4]", () => {
          it("should pass", async () => {
            let key =
              ERC725YDataKeys.LSP6["AddressPermissions[]"].index +
              "00000000000000000000000000000004";

            let value = "0x";

            let payload = context.universalProfile.interface.encodeFunctionData(
              "setData(bytes32,bytes)",
              [key, value]
            );

            await context.keyManager
              .connect(context.owner)
              ["execute(bytes)"](payload);

            // prettier-ignore
            const result = await context.universalProfile["getData(bytes32)"](key);
            expect(result).to.equal(value);
          });
        });

        // this include any permission data key that start with bytes6(keccak256('AddressPermissions'))
        describe("if the data key starts with AddressPermissions: but is a non-standard LSP6 permission data key", () => {
          it("should revert", async () => {
            let beneficiary = context.accounts[8];

            // AddressPermissions:MyCustomPermissions:<address>
            let key =
              "0x4b80742de2bf9e659ba40000" + beneficiary.address.substring(2);

            // the value does not matter in the case of the test here
            let value =
              "0x0000000000000000000000000000000000000000000000000000000000000008";

            let payload = context.universalProfile.interface.encodeFunctionData(
              "setData(bytes32,bytes)",
              [key, value]
            );

            await expect(
              context.keyManager
                .connect(context.owner)
                ["execute(bytes)"](payload)
            )
              .to.be.revertedWithCustomError(
                context.keyManager,
                "NotRecognisedPermissionKey"
              )
              .withArgs(key.toLowerCase());
          });
        });
      });

      describe("when caller is an address with permission ADDCONTROLLER", () => {
        it("should be allowed to ADD a permission", async () => {
          let newController = ethers.Wallet.createRandom();

          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
            newController.address.substring(2);

          let value = PERMISSIONS.SETDATA;

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await context.keyManager
            .connect(canOnlyAddController)
            ["execute(bytes)"](payload);

          // prettier-ignore
          const result = await context.universalProfile["getData(bytes32)"](key);
          expect(result).to.equal(value);
        });

        it("should not be allowed to CHANGE a permission", async () => {
          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
            addressToEditPermissions.address.substring(2);

          let value = PERMISSIONS.SETDATA;

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await expect(
            context.keyManager
              .connect(canOnlyAddController)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
            .withArgs(canOnlyAddController.address, "CHANGEPERMISSIONS");
        });

        describe("when editing `AddressPermissions[]` array length", () => {
          it("should be allowed to increment the length", async () => {
            let key = ERC725YDataKeys.LSP6["AddressPermissions[]"].length;
            let value = ethers.utils.hexZeroPad(ethers.utils.hexlify(8), 32);

            let payload = context.universalProfile.interface.encodeFunctionData(
              "setData(bytes32,bytes)",
              [key, value]
            );

            await context.keyManager
              .connect(canOnlyAddController)
              ["execute(bytes)"](payload);

            // prettier-ignore
            const result = await context.universalProfile["getData(bytes32)"](key);
            expect(result).to.equal(value);
          });

          it("should not be allowed to decrement the length", async () => {
            let key = ERC725YDataKeys.LSP6["AddressPermissions[]"].length;
            let value = ethers.utils.hexZeroPad(ethers.utils.hexlify(4), 32);

            let payload = context.universalProfile.interface.encodeFunctionData(
              "setData(bytes32,bytes)",
              [key, value]
            );

            await expect(
              context.keyManager
                .connect(canOnlyAddController)
                ["execute(bytes)"](payload)
            )
              .to.be.revertedWithCustomError(
                context.keyManager,
                "NotAuthorised"
              )
              .withArgs(canOnlyAddController.address, "CHANGEPERMISSIONS");
          });
        });

        describe("when adding a new address at index -> AddressPermissions[6]", () => {
          it("should be allowed to set a new 20 bytes long address", async () => {
            let key =
              ERC725YDataKeys.LSP6["AddressPermissions[]"].index +
              "00000000000000000000000000000006";
            let value = ethers.Wallet.createRandom().address.toLowerCase();

            let payload = context.universalProfile.interface.encodeFunctionData(
              "setData(bytes32,bytes)",
              [key, value]
            );

            await context.keyManager
              .connect(canOnlyAddController)
              ["execute(bytes)"](payload);

            const result = await context.universalProfile["getData(bytes32)"](
              key
            );
            expect(result).to.equal(value);
          });

          it("should revert when setting a random 10 bytes value", async () => {
            let key =
              ERC725YDataKeys.LSP6["AddressPermissions[]"].index +
              "00000000000000000000000000000006";
            let randomValue = "0xcafecafecafecafecafe";

            // set some random bytes under AddressPermissions[7]
            let setupPayload =
              context.universalProfile.interface.encodeFunctionData(
                "setData(bytes32,bytes)",
                [key, randomValue]
              );

            await expect(
              context.keyManager
                .connect(canOnlyAddController)
                ["execute(bytes)"](setupPayload)
            )
              .to.be.revertedWithCustomError(
                context.keyManager,
                "AddressPermissionArrayIndexValueNotAnAddress"
              )
              .withArgs(key, randomValue);
          });

          it("should revert when setting a random 30 bytes value", async () => {
            let key =
              ERC725YDataKeys.LSP6["AddressPermissions[]"].index +
              "00000000000000000000000000000006";
            let randomValue =
              "0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef";

            // set some random bytes under AddressPermissions[7]
            let setupPayload =
              context.universalProfile.interface.encodeFunctionData(
                "setData(bytes32,bytes)",
                [key, randomValue]
              );

            await expect(
              context.keyManager
                .connect(canOnlyAddController)
                ["execute(bytes)"](setupPayload)
            )
              .to.be.revertedWithCustomError(
                context.keyManager,
                "AddressPermissionArrayIndexValueNotAnAddress"
              )
              .withArgs(key, randomValue);
          });
        });

        describe("when editing the value stored at index -> AddressPermissions[4]", () => {
          it("should not be allowed to set an address", async () => {
            let randomWallet = ethers.Wallet.createRandom();

            let key =
              ERC725YDataKeys.LSP6["AddressPermissions[]"].index +
              "00000000000000000000000000000004";

            let value = randomWallet.address;

            let payload = context.universalProfile.interface.encodeFunctionData(
              "setData(bytes32,bytes)",
              [key, value]
            );

            await expect(
              context.keyManager
                .connect(canOnlyAddController)
                ["execute(bytes)"](payload)
            )
              .to.be.revertedWithCustomError(
                context.keyManager,
                "NotAuthorised"
              )
              .withArgs(canOnlyAddController.address, "CHANGEPERMISSIONS");
          });
        });

        describe("when removing the address at index -> AddressPermissions[4]", () => {
          it("should not be allowed to remove an address", async () => {
            let key =
              ERC725YDataKeys.LSP6["AddressPermissions[]"].index +
              "00000000000000000000000000000004";

            let value = "0x";

            let payload = context.universalProfile.interface.encodeFunctionData(
              "setData(bytes32,bytes)",
              [key, value]
            );

            await expect(
              context.keyManager
                .connect(canOnlyAddController)
                ["execute(bytes)"](payload)
            )
              .to.be.revertedWithCustomError(
                context.keyManager,
                "NotAuthorised"
              )
              .withArgs(canOnlyAddController.address, "CHANGEPERMISSIONS");
          });
        });

        describe("if the data key starts with AddressPermissions: but is a non-standard LSP6 permission data key", () => {
          it("should revert when trying to set a non-standard LSP6 permission data key", async () => {
            // this include any permission data key that start with bytes8(keccak256('AddressPermissions'))
            let beneficiary = context.accounts[8];

            // AddressPermissions:MyCustomPermissions:<address>
            let key =
              "0x4b80742de2bf9e659ba40000" + beneficiary.address.substring(2);

            // the value does not matter in the case of the test here
            let value =
              "0x0000000000000000000000000000000000000000000000000000000000000008";

            let payload = context.universalProfile.interface.encodeFunctionData(
              "setData(bytes32,bytes)",
              [key, value]
            );

            await expect(
              context.keyManager
                .connect(canOnlyAddController)
                ["execute(bytes)"](payload)
            )
              .to.be.revertedWithCustomError(
                context.keyManager,
                "NotRecognisedPermissionKey"
              )
              .withArgs(key.toLowerCase());
          });
        });
      });

      describe("when caller is an address with permission CHANGEPERMISSION", () => {
        it("should not be allowed to ADD a permission", async () => {
          let newController = ethers.Wallet.createRandom();

          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
            newController.address.substr(2);

          let value = PERMISSIONS.SETDATA;

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await expect(
            context.keyManager
              .connect(canOnlyChangePermissions)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
            .withArgs(canOnlyChangePermissions.address, "ADDCONTROLLER");
        });

        it("should not be allowed to set (= ADD) a permission for an address that has 32 x 0 bytes (0x0000...0000) as permission value", async () => {
          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
            addressWithZeroHexPermissions.address.substring(2);
          let value = PERMISSIONS.SETDATA;

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await expect(
            context.keyManager
              .connect(canOnlyChangePermissions)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
            .withArgs(canOnlyChangePermissions.address, "ADDCONTROLLER");
        });

        it("should be allowed to CHANGE a permission", async () => {
          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
            addressToEditPermissions.address.substring(2);

          let value = PERMISSIONS.SETDATA;

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await context.keyManager
            .connect(canOnlyChangePermissions)
            ["execute(bytes)"](payload);

          // prettier-ignore
          const result = await context.universalProfile["getData(bytes32)"](key);
          expect(result).to.equal(value);
        });

        describe("when editing `AddressPermissions[]` array length", () => {
          it("should not be allowed to increment the 'AddressPermissions[]' key (length)", async () => {
            let key = ERC725YDataKeys.LSP6["AddressPermissions[]"].length;
            let value = ethers.utils.hexZeroPad(ethers.utils.hexlify(8), 32);

            let payload = context.universalProfile.interface.encodeFunctionData(
              "setData(bytes32,bytes)",
              [key, value]
            );

            await expect(
              context.keyManager
                .connect(canOnlyChangePermissions)
                ["execute(bytes)"](payload)
            )
              .to.be.revertedWithCustomError(
                context.keyManager,
                "NotAuthorised"
              )
              .withArgs(canOnlyChangePermissions.address, "ADDCONTROLLER");
          });

          it("should be allowed to decrement the 'AddressPermissions[]' key (length)", async () => {
            let key = ERC725YDataKeys.LSP6["AddressPermissions[]"].length;
            let value = ethers.utils.hexZeroPad(ethers.utils.hexlify(4), 32);

            let payload = context.universalProfile.interface.encodeFunctionData(
              "setData(bytes32,bytes)",
              [key, value]
            );

            await context.keyManager
              .connect(canOnlyChangePermissions)
              ["execute(bytes)"](payload);

            // prettier-ignore
            const result = await context.universalProfile["getData(bytes32)"](key);
            expect(result).to.equal(value);
          });
        });

        describe("when adding a new address at index -> AddressPermissions[6]", () => {
          it("should not be allowed", async () => {
            let key =
              ERC725YDataKeys.LSP6["AddressPermissions[]"].index +
              "00000000000000000000000000000006";
            let value = ethers.Wallet.createRandom().address.toLowerCase();

            let payload = context.universalProfile.interface.encodeFunctionData(
              "setData(bytes32,bytes)",
              [key, value]
            );

            await expect(
              context.keyManager
                .connect(canOnlyChangePermissions)
                ["execute(bytes)"](payload)
            )
              .to.be.revertedWithCustomError(
                context.keyManager,
                "NotAuthorised"
              )
              .withArgs(canOnlyChangePermissions.address, "ADDCONTROLLER");
          });
        });

        describe("when editing the value stored at index -> AddressPermissions[4]", () => {
          it("should be allowed", async () => {
            let randomWallet = ethers.Wallet.createRandom();

            let key =
              ERC725YDataKeys.LSP6["AddressPermissions[]"].index +
              "00000000000000000000000000000004";

            let value = randomWallet.address;

            let payload = context.universalProfile.interface.encodeFunctionData(
              "setData(bytes32,bytes)",
              [key, value]
            );

            await context.keyManager
              .connect(canOnlyChangePermissions)
              ["execute(bytes)"](payload);

            // prettier-ignore
            const result = await context.universalProfile["getData(bytes32)"](key);
            expect(ethers.utils.getAddress(result)).to.equal(value);
          });

          it("should revert when setting a random 10 bytes value", async () => {
            let key =
              ERC725YDataKeys.LSP6["AddressPermissions[]"].index +
              "00000000000000000000000000000004";
            let randomValue = "0xcafecafecafecafecafe";

            // set some random bytes under AddressPermissions[7]
            let setupPayload =
              context.universalProfile.interface.encodeFunctionData(
                "setData(bytes32,bytes)",
                [key, randomValue]
              );

            await expect(
              context.keyManager
                .connect(canOnlyChangePermissions)
                ["execute(bytes)"](setupPayload)
            )
              .to.be.revertedWithCustomError(
                context.keyManager,
                "AddressPermissionArrayIndexValueNotAnAddress"
              )
              .withArgs(key, randomValue);
          });

          it("should revert when setting a random 30 bytes value", async () => {
            let key =
              ERC725YDataKeys.LSP6["AddressPermissions[]"].index +
              "00000000000000000000000000000004";
            let randomValue =
              "0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef";

            // set some random bytes under AddressPermissions[7]
            let setupPayload =
              context.universalProfile.interface.encodeFunctionData(
                "setData(bytes32,bytes)",
                [key, randomValue]
              );

            await expect(
              context.keyManager
                .connect(canOnlyChangePermissions)
                ["execute(bytes)"](setupPayload)
            )
              .to.be.revertedWithCustomError(
                context.keyManager,
                "AddressPermissionArrayIndexValueNotAnAddress"
              )
              .withArgs(key, randomValue);
          });
        });

        describe("when removing the address at index -> AddressPermissions[4]", () => {
          it("should pass", async () => {
            let key =
              ERC725YDataKeys.LSP6["AddressPermissions[]"].index +
              "00000000000000000000000000000004";

            let value = "0x";

            let payload = context.universalProfile.interface.encodeFunctionData(
              "setData(bytes32,bytes)",
              [key, value]
            );

            await context.keyManager
              .connect(canOnlyChangePermissions)
              ["execute(bytes)"](payload);

            // prettier-ignore
            const result = await context.universalProfile["getData(bytes32)"](key);
            expect(result).to.equal(value);
          });
        });

        describe("if the data key starts with AddressPermissions: but is a non-standard LSP6 permission data key", () => {
          it("should revert when trying to set a non-standard LSP6 permission data key", async () => {
            // this include any permission data key that start with bytes8(keccak256('AddressPermissions'))
            let beneficiary = context.accounts[8];

            // AddressPermissions:MyCustomPermissions:<address>
            let key =
              "0x4b80742de2bf9e659ba40000" + beneficiary.address.substring(2);

            // the value does not matter in the case of the test here
            let value =
              "0x0000000000000000000000000000000000000000000000000000000000000008";

            let payload = context.universalProfile.interface.encodeFunctionData(
              "setData(bytes32,bytes)",
              [key, value]
            );

            await expect(
              context.keyManager
                .connect(canOnlyChangePermissions)
                ["execute(bytes)"](payload)
            )
              .to.be.revertedWithCustomError(
                context.keyManager,
                "NotRecognisedPermissionKey"
              )
              .withArgs(key.toLowerCase());
          });
        });
      });

      describe("when caller is an address with permission SETDATA", () => {
        it("should not be allowed to ADD a permission", async () => {
          let newController = ethers.Wallet.createRandom();

          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
            newController.address.substr(2);

          let value = PERMISSIONS.SETDATA;

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await expect(
            context.keyManager
              .connect(canOnlySetData)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
            .withArgs(canOnlySetData.address, "ADDCONTROLLER");
        });

        it("should not be allowed to set (= ADD) a permission for an address that has 32 x 0 bytes (0x0000...0000) as permission value", async () => {
          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
            addressWithZeroHexPermissions.address.substring(2);
          let value = PERMISSIONS.SETDATA;

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await expect(
            context.keyManager
              .connect(canOnlySetData)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
            .withArgs(canOnlySetData.address, "ADDCONTROLLER");
        });

        it("should not be allowed to CHANGE a permission", async () => {
          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
            addressToEditPermissions.address.substring(2);

          let value = PERMISSIONS.SETDATA;

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await expect(
            context.keyManager
              .connect(canOnlySetData)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
            .withArgs(canOnlySetData.address, "CHANGEPERMISSIONS");
        });

        describe("when editing `AddressPermissions[]` array length", () => {
          it("should not be allowed to increment the length", async () => {
            let key = ERC725YDataKeys.LSP6["AddressPermissions[]"].length;
            let value = ethers.utils.hexZeroPad(ethers.utils.hexlify(8), 32);

            let payload = context.universalProfile.interface.encodeFunctionData(
              "setData(bytes32,bytes)",
              [key, value]
            );

            await expect(
              context.keyManager
                .connect(canOnlySetData)
                ["execute(bytes)"](payload)
            )
              .to.be.revertedWithCustomError(
                context.keyManager,
                "NotAuthorised"
              )
              .withArgs(canOnlySetData.address, "ADDCONTROLLER");
          });

          it("should not be allowed to decrement the length", async () => {
            let key = ERC725YDataKeys.LSP6["AddressPermissions[]"].length;
            let value = ethers.utils.hexZeroPad(ethers.utils.hexlify(4), 32);

            let payload = context.universalProfile.interface.encodeFunctionData(
              "setData(bytes32,bytes)",
              [key, value]
            );

            await expect(
              context.keyManager
                .connect(canOnlySetData)
                ["execute(bytes)"](payload)
            )
              .to.be.revertedWithCustomError(
                context.keyManager,
                "NotAuthorised"
              )
              .withArgs(canOnlySetData.address, "CHANGEPERMISSIONS");
          });
        });

        describe("when removing the address at index -> AddressPermissions[4]", () => {
          it("should revert", async () => {
            let key =
              ERC725YDataKeys.LSP6["AddressPermissions[]"].index +
              "00000000000000000000000000000004";

            let value = "0x";

            let payload = context.universalProfile.interface.encodeFunctionData(
              "setData(bytes32,bytes)",
              [key, value]
            );

            await expect(
              context.keyManager
                .connect(canOnlySetData)
                ["execute(bytes)"](payload)
            )
              .to.be.revertedWithCustomError(
                context.keyManager,
                "NotAuthorised"
              )
              .withArgs(canOnlySetData.address, "CHANGEPERMISSIONS");
          });
        });

        it("should not be allowed to add a new address at index -> AddressPermissions[6]", async () => {
          let key =
            ERC725YDataKeys.LSP6["AddressPermissions[]"].index +
            "00000000000000000000000000000006";
          let value = ethers.Wallet.createRandom().address.toLowerCase();

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await expect(
            context.keyManager
              .connect(canOnlySetData)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
            .withArgs(canOnlySetData.address, "ADDCONTROLLER");
        });

        it("should not be allowed to edit key at index -> AddressPermissions[4]", async () => {
          let randomWallet = ethers.Wallet.createRandom();

          let key =
            ERC725YDataKeys.LSP6["AddressPermissions[]"].index +
            "00000000000000000000000000000004";

          let value = randomWallet.address;

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await expect(
            context.keyManager
              .connect(canOnlySetData)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
            .withArgs(canOnlySetData.address, "CHANGEPERMISSIONS");
        });

        describe("if the data key starts with AddressPermissions: but is a non-standard LSP6 permission data key", () => {
          it("should revert when trying to set a non-standard LSP6 permission data key", async () => {
            // this include any permission data key that start with bytes8(keccak256('AddressPermissions'))
            let beneficiary = context.accounts[8];

            // AddressPermissions:MyCustomPermissions:<address>
            let key =
              "0x4b80742de2bf9e659ba40000" + beneficiary.address.substring(2);

            // the value does not matter in the case of the test here
            let value =
              "0x0000000000000000000000000000000000000000000000000000000000000008";

            let payload = context.universalProfile.interface.encodeFunctionData(
              "setData(bytes32,bytes)",
              [key, value]
            );

            await expect(
              context.keyManager
                .connect(canOnlySetData)
                ["execute(bytes)"](payload)
            )
              .to.be.revertedWithCustomError(
                context.keyManager,
                "NotRecognisedPermissionKey"
              )
              .withArgs(key.toLowerCase());
          });
        });
      });

      /**
       *  @todo should test that an address with only the permission SETDATA
       * cannot add or edit permissions
       */
    });
  });

  describe("deleting AllowedCalls", () => {
    let canOnlyAddController: SignerWithAddress,
      canOnlyChangePermissions: SignerWithAddress;

    let beneficiary: SignerWithAddress;
    let invalidBytes: SignerWithAddress;
    let noBytes: SignerWithAddress;

    before(async () => {
      context = await buildContext();

      canOnlyAddController = context.accounts[1];
      canOnlyChangePermissions = context.accounts[2];

      beneficiary = context.accounts[3];
      invalidBytes = context.accounts[4];
      noBytes = context.accounts[5];

      let permissionKeys = [
        ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
          canOnlyAddController.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
          canOnlyChangePermissions.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
          invalidBytes.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
          noBytes.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          beneficiary.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          invalidBytes.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          noBytes.address.substring(2),
      ];

      let permissionValues = [
        PERMISSIONS.ADDCONTROLLER,
        PERMISSIONS.CHANGEPERMISSIONS,
        PERMISSIONS.CALL,
        PERMISSIONS.CALL,
        combineAllowedCalls(
          ["0xffffffff", "0xffffffff"],
          [
            "0xcafecafecafecafecafecafecafecafecafecafe",
            "0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef",
          ],
          ["0xffffffff", "0xffffffff"]
        ),
        "0xbadbadbadbad",
        "0x",
      ];

      await setupKeyManager(context, permissionKeys, permissionValues);
    });

    describe("when caller has ADD permission", () => {
      it("should revert and not be allowed to clear the list of allowed calls for an address", async () => {
        const dataKey =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          beneficiary.address.substring(2);
        const dataValue = "0x";

        const setDataPayload =
          context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [dataKey, dataValue]
          );

        await expect(
          context.keyManager
            .connect(canOnlyAddController)
            ["execute(bytes)"](setDataPayload)
        )
          .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
          .withArgs(canOnlyAddController.address, "CHANGEPERMISSIONS");
      });
    });

    describe("when caller has CHANGE permission", () => {
      it("should allow to clear the list of allowed calls for an address", async () => {
        const dataKey =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          beneficiary.address.substring(2);
        const dataValue = "0x";

        const setDataPayload =
          context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [dataKey, dataValue]
          );

        await context.keyManager
          .connect(canOnlyChangePermissions)
          ["execute(bytes)"](setDataPayload);

        const result = await context.universalProfile["getData(bytes32)"](
          dataKey
        );
        expect(result).to.equal(dataValue);
      });
    });
  });

  describe("setting Allowed Calls -> Addresses", () => {
    let canOnlyAddController: SignerWithAddress,
      canOnlyChangePermissions: SignerWithAddress;

    let beneficiary: SignerWithAddress,
      invalidBeneficiary: SignerWithAddress,
      zero32Bytes: SignerWithAddress,
      zero40Bytes: SignerWithAddress;

    before(async () => {
      context = await buildContext();

      canOnlyAddController = context.accounts[1];
      canOnlyChangePermissions = context.accounts[2];

      beneficiary = context.accounts[3];
      invalidBeneficiary = context.accounts[4];
      zero32Bytes = context.accounts[5];
      zero40Bytes = context.accounts[6];

      let permissionKeys = [
        ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
          canOnlyAddController.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
          canOnlyChangePermissions.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          beneficiary.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          invalidBeneficiary.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          zero32Bytes.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          zero40Bytes.address.substring(2),
      ];

      let permissionValues = [
        PERMISSIONS.ADDCONTROLLER,
        PERMISSIONS.CHANGEPERMISSIONS,
        combineAllowedCalls(
          ["0xffffffff", "0xffffffff"],
          [
            "0xcafecafecafecafecafecafecafecafecafecafe",
            "0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef",
          ],
          ["0xffffffff", "0xffffffff"]
        ),
        "0x11223344",
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000",
      ];

      await setupKeyManager(context, permissionKeys, permissionValues);
    });

    describe("when caller has permission ADDCONTROLLER", () => {
      it("should fail when trying to edit existing allowed addresses for an address", async () => {
        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          beneficiary.address.substring(2);

        let value = combineAllowedCalls(
          ["0xffffffff", "0xffffffff"],
          [
            "0xcafecafecafecafecafecafecafecafecafecafe",
            "0xca11ca11ca11ca11ca11ca11ca11ca11ca11ca11",
          ],
          ["0xffffffff", "0xffffffff"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await expect(
          context.keyManager
            .connect(canOnlyAddController)
            ["execute(bytes)"](payload)
        )
          .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
          .withArgs(canOnlyAddController.address, "CHANGEPERMISSIONS");
      });

      it("should fail with NotAuthorised -> when beneficiary address had an invalid bytes28[CompatBytesArray]", async () => {
        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          invalidBeneficiary.address.substring(2);

        let value = combineAllowedCalls(
          ["0xffffffff", "0xffffffff"],
          [
            "0xcafecafecafecafecafecafecafecafecafecafe",
            "0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef",
          ],
          ["0xffffffff", "0xffffffff"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await expect(
          context.keyManager
            .connect(canOnlyAddController)
            ["execute(bytes)"](payload)
        )
          .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
          .withArgs(canOnlyAddController.address, "CHANGEPERMISSIONS");
      });

      /**
       * TODO: this test pass but behaviour when some zero bytes are stored must be clarified.
       */
      it.skip("should fail with NotAuthorised -> when beneficiary had 32 x 0 bytes set initially as allowed calls", async () => {
        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          zero32Bytes.address.substring(2);

        let value = combineAllowedCalls(
          ["0xffffffff", "0xffffffff"],
          [
            "0xcafecafecafecafecafecafecafecafecafecafe",
            "0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef",
          ],
          ["0xffffffff", "0xffffffff"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await expect(
          context.keyManager
            .connect(canOnlyAddController)
            ["execute(bytes)"](payload)
        )
          .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
          .withArgs(canOnlyAddController.address, "CHANGEPERMISSIONS");
      });

      /**
       * TODO: this test pass but behaviour when some zero bytes are stored must be clarified.
       */
      it.skip("should fail with NotAuthorised -> when beneficiary had 40 x 0 bytes set initially as allowed calls", async () => {
        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          zero40Bytes.address.substring(2);

        let value = combineAllowedCalls(
          ["0xffffffff", "0xffffffff"],
          [
            "0xcafecafecafecafecafecafecafecafecafecafe",
            "0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef",
          ],
          ["0xffffffff", "0xffffffff"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await expect(
          context.keyManager
            .connect(canOnlyAddController)
            ["execute(bytes)"](payload)
        )
          .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
          .withArgs(canOnlyAddController.address, "CHANGEPERMISSIONS");
      });

      it("should pass when beneficiary had no values set under AddressPermissions:AllowedCalls:... + setting a valid bytes28[CompactBytesArray]", async () => {
        let newController = ethers.Wallet.createRandom();

        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          newController.address.substr(2);

        let value = combineAllowedCalls(
          ["0xffffffff", "0xffffffff"],
          [
            "0xcafecafecafecafecafecafecafecafecafecafe",
            "0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef",
          ],
          ["0xffffffff", "0xffffffff"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await context.keyManager
          .connect(canOnlyAddController)
          ["execute(bytes)"](payload);

        // prettier-ignore
        const result = await context.universalProfile["getData(bytes32)"](key);
        expect(result).to.equal(value);
      });

      describe("when setting an invalid bytes28[CompactBytesArray] for a new beneficiary", () => {
        it("should revert with error when value = random bytes", async () => {
          let newController = ethers.Wallet.createRandom();

          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
            newController.address.substr(2);

          let value = "0xbadbadbadbad";

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await expect(
            context.keyManager
              .connect(canOnlyAddController)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(
              context.keyManager,
              "InvalidEncodedAllowedCalls"
            )
            .withArgs(value);
        });

        it("should revert with error when value = invalid bytes28[CompactBytesArray] (not enough bytes, missing the first length bytes)", async () => {
          let newController = ethers.Wallet.createRandom();

          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
            newController.address.substr(2);

          let value =
            "0xffffffffcafecafecafecafecafecafecafecafecafecafeffffffff";

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await expect(
            context.keyManager
              .connect(canOnlyAddController)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(
              context.keyManager,
              "InvalidEncodedAllowedCalls"
            )
            .withArgs(value);
        });
      });
    });

    describe("when caller has permission CHANGEPERMISSIONS", () => {
      it("should fail when beneficiary had no values set under AddressPermissions:AllowedCalls:...", async () => {
        let newController = ethers.Wallet.createRandom();

        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          newController.address.substr(2);

        let value = combineAllowedCalls(
          ["0xffffffff", "0xffffffff"],
          [
            "0xcafecafecafecafecafecafecafecafecafecafe",
            "0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef",
          ],
          ["0xffffffff", "0xffffffff"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await expect(
          context.keyManager
            .connect(canOnlyChangePermissions)
            ["execute(bytes)"](payload)
        )
          .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
          .withArgs(canOnlyChangePermissions.address, "ADDCONTROLLER");
      });

      it("should pass when trying to edit existing allowed addresses for an address", async () => {
        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          beneficiary.address.substring(2);

        let value = combineAllowedCalls(
          ["0xffffffff", "0xffffffff"],
          [
            "0xcafecafecafecafecafecafecafecafecafecafe",
            "0xca11ca11ca11ca11ca11ca11ca11ca11ca11ca11",
          ],
          ["0xffffffff", "0xffffffff"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await context.keyManager
          .connect(canOnlyChangePermissions)
          ["execute(bytes)"](payload);

        // prettier-ignore
        const result = await context.universalProfile["getData(bytes32)"](key);
        expect(result).to.equal(value);
      });

      it("should pass when address had an invalid bytes28[CompactBytesArray] initially", async () => {
        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          invalidBeneficiary.address.substring(2);

        let value = combineAllowedCalls(
          ["0xffffffff", "0xffffffff"],
          [
            "0xcafecafecafecafecafecafecafecafecafecafe",
            "0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef",
          ],
          ["0xffffffff", "0xffffffff"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await context.keyManager
          .connect(canOnlyChangePermissions)
          ["execute(bytes)"](payload);

        // prettier-ignore
        const result = await context.universalProfile["getData(bytes32)"](key);
        expect(result).to.equal(value);
      });

      /**
       * TODO: this test pass but behaviour when some zero bytes are stored must be clarified.
       */
      it.skip("should pass when address had 32 x 0 bytes set initially as allowed calls", async () => {
        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          zero32Bytes.address.substring(2);

        let value = combineAllowedCalls(
          ["0xffffffff", "0xffffffff"],
          [
            "0xcafecafecafecafecafecafecafecafecafecafe",
            "0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef",
          ],
          ["0xffffffff", "0xffffffff"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await context.keyManager
          .connect(canOnlyChangePermissions)
          ["execute(bytes)"](payload);

        // prettier-ignore
        const result = await context.universalProfile["getData(bytes32)"](key);
        expect(result).to.equal(value);
      });

      /**
       * TODO: this test pass but behaviour when some zero bytes are stored must be clarified.
       */
      it.skip("should pass when address had 40 x 0 bytes set initially as allowed addresses", async () => {
        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          zero40Bytes.address.substring(2);

        let value = combineAllowedCalls(
          ["0xffffffff", "0xffffffff"],
          [
            "0xcafecafecafecafecafecafecafecafecafecafe",
            "0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef",
          ],
          ["0xffffffff", "0xffffffff"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await context.keyManager
          .connect(canOnlyChangePermissions)
          ["execute(bytes)"](payload);

        // prettier-ignore
        const result = await context.universalProfile["getData(bytes32)"](key);
        expect(result).to.equal(value);
      });

      describe("when changing the list of allowed calls from existing ANY:<address>:ANY to an invalid value", () => {
        it("should revert with error when value = random bytes", async () => {
          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
            beneficiary.address.substring(2);

          let value = "0xbadbadbadbad";

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await expect(
            context.keyManager
              .connect(canOnlyChangePermissions)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(
              context.keyManager,
              "InvalidEncodedAllowedCalls"
            )
            .withArgs(value);
        });

        it("should revert with error when value = invalid bytes28[CompactBytesArray] (not enough bytes, missing the first length byte)", async () => {
          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
            beneficiary.address.substring(2);

          let value =
            "0xffffffffcafecafecafecafecafecafecafecafecafecafeffffffff";

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await expect(
            context.keyManager
              .connect(canOnlyChangePermissions)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(
              context.keyManager,
              "InvalidEncodedAllowedCalls"
            )
            .withArgs(value);
        });
      });
    });
  });

  describe("setting Allowed Calls -> Functions", () => {
    let canOnlyAddController: SignerWithAddress,
      canOnlyChangePermissions: SignerWithAddress;

    let beneficiary: SignerWithAddress,
      invalidBeneficiary: SignerWithAddress,
      zero32Bytes: SignerWithAddress,
      zero40Bytes: SignerWithAddress;

    before(async () => {
      context = await buildContext();

      canOnlyAddController = context.accounts[1];
      canOnlyChangePermissions = context.accounts[2];

      beneficiary = context.accounts[3];
      invalidBeneficiary = context.accounts[4];
      zero32Bytes = context.accounts[5];
      zero40Bytes = context.accounts[6];

      let permissionKeys = [
        ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
          canOnlyAddController.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
          canOnlyChangePermissions.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          beneficiary.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          invalidBeneficiary.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          zero32Bytes.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          zero40Bytes.address.substring(2),
      ];

      let permissionValues = [
        PERMISSIONS.ADDCONTROLLER,
        PERMISSIONS.CHANGEPERMISSIONS,
        combineAllowedCalls(
          ["0xffffffff", "0xffffffff"],
          [
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
          ],
          ["0xcafecafe", "0xbeefbeef"]
        ),
        "0x11223344",
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000",
      ];

      await setupKeyManager(context, permissionKeys, permissionValues);
    });

    describe("when caller has permission ADDCONTROLLER", () => {
      it("should fail when trying to edit existing allowed functions for an address", async () => {
        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          beneficiary.address.substring(2);

        let value = combineAllowedCalls(
          ["0xffffffff", "0xffffffff"],
          [
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
          ],
          ["0xcafecafe", "0xca11ca11"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await expect(
          context.keyManager
            .connect(canOnlyAddController)
            ["execute(bytes)"](payload)
        )
          .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
          .withArgs(canOnlyAddController.address, "CHANGEPERMISSIONS");
      });

      it("should fail with NotAuthorised -> when beneficiary address had an invalid bytes28[CompactBytesArray] initially", async () => {
        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          invalidBeneficiary.address.substring(2);

        let value = combineAllowedCalls(
          ["0xffffffff", "0xffffffff"],
          [
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
          ],
          ["0xcafecafe", "0xca11ca11"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await expect(
          context.keyManager
            .connect(canOnlyAddController)
            ["execute(bytes)"](payload)
        )
          .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
          .withArgs(canOnlyAddController.address, "CHANGEPERMISSIONS");
      });

      /**
       * TODO: this test pass but behaviour when some zero bytes are stored must be clarified.
       */
      it.skip("should fail with NotAuthorised -> when beneficiary had 32 x 0 bytes set initially as allowed calls", async () => {
        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          zero32Bytes.address.substring(2);

        let value = combineAllowedCalls(
          ["0xffffffff", "0xffffffff"],
          [
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
          ],
          ["0xcafecafe", "0xca11ca11"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await expect(
          context.keyManager
            .connect(canOnlyAddController)
            ["execute(bytes)"](payload)
        )
          .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
          .withArgs(canOnlyAddController.address, "CHANGEPERMISSIONS");
      });

      /**
       * TODO: this test pass but behaviour when some zero bytes are stored must be clarified.
       */
      it.skip("should fail with NotAuthorised -> when beneficiary had 40 x 0 bytes set initially as allowed calls", async () => {
        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          zero40Bytes.address.substring(2);

        let value = combineAllowedCalls(
          ["0xffffffff", "0xffffffff"],
          [
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
          ],
          ["0xcafecafe", "0xca11ca11"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await expect(
          context.keyManager
            .connect(canOnlyAddController)
            ["execute(bytes)"](payload)
        )
          .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
          .withArgs(canOnlyAddController.address, "CHANGEPERMISSIONS");
      });

      it("should pass when beneficiary had no values set under AddressPermissions:AllowedCalls:... + setting a valid bytes28[CompactBytesArray]", async () => {
        let newController = ethers.Wallet.createRandom();

        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          newController.address.substr(2);

        let value = combineAllowedCalls(
          ["0xffffffff", "0xffffffff"],
          [
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
          ],
          ["0xcafecafe", "0xca11ca11"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await context.keyManager
          .connect(canOnlyAddController)
          ["execute(bytes)"](payload);

        // prettier-ignore
        const result = await context.universalProfile["getData(bytes32)"](key);
        expect(result).to.equal(value);
      });

      describe("when setting an invalid bytes28[CompactBytesArray] for a new beneficiary", () => {
        it("should fail when setting an invalid bytes28[CompactBytesArray] (= random bytes)", async () => {
          let newController = ethers.Wallet.createRandom();

          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
            newController.address.substr(2);

          let value = "0xbadbadbadbad";

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await expect(
            context.keyManager
              .connect(canOnlyAddController)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(
              context.keyManager,
              "InvalidEncodedAllowedCalls"
            )
            .withArgs(value);
        });

        it("should fail when setting an invalid bytes28[CompactBytesArray] (not enough bytes, missing first length byte)", async () => {
          let newController = ethers.Wallet.createRandom();

          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
            newController.address.substr(2);

          let value =
            "0xffffffffffffffffffffffffffffffffffffffffffffffffcafecafe";

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await expect(
            context.keyManager
              .connect(canOnlyAddController)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(
              context.keyManager,
              "InvalidEncodedAllowedCalls"
            )
            .withArgs(value);
        });
      });
    });

    describe("when caller has CHANGEPERMISSIONS", () => {
      it("should fail when beneficiary had no values set under AddressPermissions:AllowedCalls:...", async () => {
        let newController = ethers.Wallet.createRandom();

        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          newController.address.substr(2);

        let value = combineAllowedCalls(
          ["0xffffffff", "0xffffffff"],
          [
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
          ],
          ["0xcafecafe", "0xbeefbeef"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await expect(
          context.keyManager
            .connect(canOnlyChangePermissions)
            ["execute(bytes)"](payload)
        )
          .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
          .withArgs(canOnlyChangePermissions.address, "ADDCONTROLLER");
      });

      it("should pass when trying to edit existing allowed bytes4 selectors under ANY:ANY:<selector>", async () => {
        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          beneficiary.address.substring(2);

        let value = combineAllowedCalls(
          ["0xffffffff", "0xffffffff"],
          [
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
          ],
          ["0xcafecafe", "0xca11ca11"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await context.keyManager
          .connect(canOnlyChangePermissions)
          ["execute(bytes)"](payload);

        // prettier-ignore
        const result = await context.universalProfile["getData(bytes32)"](key);
        expect(result).to.equal(value);
      });

      it("should pass when address had an invalid bytes28[CompactBytesArray] initially", async () => {
        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          invalidBeneficiary.address.substring(2);

        let value = combineAllowedCalls(
          ["0xffffffff", "0xffffffff"],
          [
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
          ],
          ["0xcafecafe", "0xbeefbeef"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await context.keyManager
          .connect(canOnlyChangePermissions)
          ["execute(bytes)"](payload);

        // prettier-ignore
        const result = await context.universalProfile["getData(bytes32)"](key);
        expect(result).to.equal(value);
      });

      /**
       * TODO: this test pass but behaviour when some zero bytes are stored must be clarified.
       */
      it.skip("should pass when address had 32 x 0 bytes set initially as allowed calls", async () => {
        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          zero32Bytes.address.substring(2);

        let value = combineAllowedCalls(
          ["0xffffffff", "0xffffffff"],
          [
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
          ],
          ["0xcafecafe", "0xbeefbeef"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await context.keyManager
          .connect(canOnlyChangePermissions)
          ["execute(bytes)"](payload);

        // prettier-ignore
        const result = await context.universalProfile["getData(bytes32)"](key);
        expect(result).to.equal(value);
      });

      /**
       * TODO: this test pass but behaviour when some zero bytes are stored must be clarified.
       */
      it.skip("should pass when address had 40 x 0 bytes set initially as allowed functions", async () => {
        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          zero40Bytes.address.substring(2);

        let value = combineAllowedCalls(
          ["0xffffffff", "0xffffffff"],
          [
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
          ],
          ["0xcafecafe", "0xbeefbeef"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await context.keyManager
          .connect(canOnlyChangePermissions)
          ["execute(bytes)"](payload);

        // prettier-ignore
        const result = await context.universalProfile["getData(bytes32)"](key);
        expect(result).to.equal(value);
      });

      describe("when changing the list of selectors in allowed calls from existing ANY:ANY:<selector> to an invalid value", () => {
        it("should revert with error when value = random bytes", async () => {
          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
            beneficiary.address.substring(2);

          let value = "0xbadbadbadbad";

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await expect(
            context.keyManager
              .connect(canOnlyChangePermissions)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(
              context.keyManager,
              "InvalidEncodedAllowedCalls"
            )
            .withArgs(value);
        });

        it("should revert with error when value = invalid bytes28[CompactBytesArray] (not enough bytes, missing first length byte)", async () => {
          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
            beneficiary.address.substring(2);

          let value =
            "0xffffffffffffffffffffffffffffffffffffffffffffffffcafecafe";

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await expect(
            context.keyManager
              .connect(canOnlyChangePermissions)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(
              context.keyManager,
              "InvalidEncodedAllowedCalls"
            )
            .withArgs(value);
        });
      });
    });
  });

  describe("setting Allowed Calls -> Standards", () => {
    let canOnlyAddController: SignerWithAddress,
      canOnlyChangePermissions: SignerWithAddress;

    let beneficiary: SignerWithAddress,
      invalidBeneficiary: SignerWithAddress,
      zero32Bytes: SignerWithAddress,
      zero40Bytes: SignerWithAddress;

    before(async () => {
      context = await buildContext();

      canOnlyAddController = context.accounts[1];
      canOnlyChangePermissions = context.accounts[2];

      beneficiary = context.accounts[3];
      invalidBeneficiary = context.accounts[4];
      zero32Bytes = context.accounts[5];
      zero40Bytes = context.accounts[6];

      let permissionKeys = [
        ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
          canOnlyAddController.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
          canOnlyChangePermissions.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          beneficiary.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          invalidBeneficiary.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          zero32Bytes.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          zero40Bytes.address.substring(2),
      ];

      let permissionValues = [
        PERMISSIONS.ADDCONTROLLER,
        PERMISSIONS.CHANGEPERMISSIONS,
        combineAllowedCalls(
          [INTERFACE_IDS.LSP7DigitalAsset, INTERFACE_IDS.ERC20],
          [
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
          ],
          ["0xffffffff", "0xffffffff"]
        ),
        "0x11223344",
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000",
      ];

      await setupKeyManager(context, permissionKeys, permissionValues);
    });

    describe("when caller has ADDCONTROLLER", () => {
      it("should fail when trying to edit existing allowed standards for an address", async () => {
        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          beneficiary.address.substring(2);

        let value = combineAllowedCalls(
          [
            INTERFACE_IDS.LSP7DigitalAsset,
            INTERFACE_IDS.ERC20,
            INTERFACE_IDS.LSP8IdentifiableDigitalAsset, // try to allow interacting with NFTs
            INTERFACE_IDS.ERC721,
          ],
          [
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
          ],
          ["0xffffffff", "0xffffffff", "0xffffffff", "0xffffffff"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await expect(
          context.keyManager
            .connect(canOnlyAddController)
            ["execute(bytes)"](payload)
        )
          .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
          .withArgs(canOnlyAddController.address, "CHANGEPERMISSIONS");
      });

      it("should fail with NotAuthorised -> when beneficiary address had an invalid bytes28[CompactBytesArray] initially", async () => {
        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          invalidBeneficiary.address.substring(2);

        let value = combineAllowedCalls(
          [
            INTERFACE_IDS.LSP7DigitalAsset,
            INTERFACE_IDS.ERC20,
            INTERFACE_IDS.LSP8IdentifiableDigitalAsset, // try to allow interacting with NFTs
            INTERFACE_IDS.ERC721,
          ],
          [
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
          ],
          ["0xffffffff", "0xffffffff", "0xffffffff", "0xffffffff"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await expect(
          context.keyManager
            .connect(canOnlyAddController)
            ["execute(bytes)"](payload)
        )
          .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
          .withArgs(canOnlyAddController.address, "CHANGEPERMISSIONS");
      });

      /**
       * TODO: this test pass but behaviour when some zero bytes are stored must be clarified.
       */
      it.skip("should fail with NotAuthorised -> when beneficiary had 32 x 0 bytes set initially as allowed calls", async () => {
        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          zero32Bytes.address.substring(2);

        let value = combineAllowedCalls(
          [
            INTERFACE_IDS.LSP7DigitalAsset,
            INTERFACE_IDS.ERC20,
            INTERFACE_IDS.LSP8IdentifiableDigitalAsset, // try to allow interacting with NFTs
            INTERFACE_IDS.ERC721,
          ],
          [
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
          ],
          ["0xffffffff", "0xffffffff", "0xffffffff", "0xffffffff"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await expect(
          context.keyManager
            .connect(canOnlyAddController)
            ["execute(bytes)"](payload)
        )
          .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
          .withArgs(canOnlyAddController.address, "CHANGEPERMISSIONS");
      });

      /**
       * TODO: this test pass but behaviour when some zero bytes are stored must be clarified.
       */
      it.skip("should fail with NotAuthorised -> when beneficiary had 40 x 0 bytes set initially as allowed calls", async () => {
        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          zero40Bytes.address.substring(2);

        let value = combineAllowedCalls(
          [
            INTERFACE_IDS.LSP7DigitalAsset,
            INTERFACE_IDS.ERC20,
            INTERFACE_IDS.LSP8IdentifiableDigitalAsset, // try to allow interacting with NFTs
            INTERFACE_IDS.ERC721,
          ],
          [
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
          ],
          ["0xffffffff", "0xffffffff", "0xffffffff", "0xffffffff"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await expect(
          context.keyManager
            .connect(canOnlyAddController)
            ["execute(bytes)"](payload)
        )
          .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
          .withArgs(canOnlyAddController.address, "CHANGEPERMISSIONS");
      });

      it("should pass when beneficiary had no values set under AddressPermissions:AllowedCalls:... + setting a valid bytes28[CompactBytesArray]", async () => {
        let newController = ethers.Wallet.createRandom();

        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          newController.address.substr(2);

        let value = combineAllowedCalls(
          [
            INTERFACE_IDS.LSP7DigitalAsset,
            INTERFACE_IDS.ERC20,
            INTERFACE_IDS.LSP8IdentifiableDigitalAsset, // try to allow interacting with NFTs
            INTERFACE_IDS.ERC721,
          ],
          [
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
          ],
          ["0xffffffff", "0xffffffff", "0xffffffff", "0xffffffff"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await context.keyManager
          .connect(canOnlyAddController)
          ["execute(bytes)"](payload);

        // prettier-ignore
        const result = await context.universalProfile["getData(bytes32)"](key);
        expect(result).to.equal(value);
      });

      describe("when setting an invalid bytes28[CompactBytesArray] of allowed calls for a new beneficiary", () => {
        it("should fail when setting an bytes28[CompactBytesArray] (= random bytes)", async () => {
          let newController = ethers.Wallet.createRandom();

          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
            newController.address.substr(2);

          let value = "0xbadbadbadbad";

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await expect(
            context.keyManager
              .connect(canOnlyAddController)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(
              context.keyManager,
              "InvalidEncodedAllowedCalls"
            )
            .withArgs(value);
        });

        it("should fail when setting an invalid bytes28[CompactBytesArray] (not enough bytes, missing first length byte)", async () => {
          let newController = ethers.Wallet.createRandom();

          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
            newController.address.substr(2);

          let value =
            "0xffffffffffffffffffffffffffffffffffffffffffffffffcafecafe";

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await expect(
            context.keyManager
              .connect(canOnlyAddController)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(
              context.keyManager,
              "InvalidEncodedAllowedCalls"
            )
            .withArgs(value);
        });
      });
    });

    describe("when caller has CHANGEPERMISSION", () => {
      it("should fail when beneficiary had no values set under AddressPermissions:AllowedCalls:...", async () => {
        let newController = ethers.Wallet.createRandom();

        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          newController.address.substr(2);

        let value = combineAllowedCalls(
          [INTERFACE_IDS.LSP7DigitalAsset, INTERFACE_IDS.ERC20],
          [
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
          ],
          ["0xffffffff", "0xffffffff"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await expect(
          context.keyManager
            .connect(canOnlyChangePermissions)
            ["execute(bytes)"](payload)
        )
          .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
          .withArgs(canOnlyChangePermissions.address, "ADDCONTROLLER");
      });

      it("should pass when trying to edit existing allowed standards for an address", async () => {
        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          beneficiary.address.substring(2);

        let value = combineAllowedCalls(
          [
            INTERFACE_IDS.LSP7DigitalAsset,
            INTERFACE_IDS.ERC20,
            INTERFACE_IDS.LSP8IdentifiableDigitalAsset, // try to allow interacting with NFTs
            INTERFACE_IDS.ERC721,
          ],
          [
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
          ],
          ["0xffffffff", "0xffffffff", "0xffffffff", "0xffffffff"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await context.keyManager
          .connect(canOnlyChangePermissions)
          ["execute(bytes)"](payload);

        // prettier-ignore
        const result = await context.universalProfile["getData(bytes32)"](key);
        expect(result).to.equal(value);
      });

      it("should pass when address had an invalid bytes28[CompactBytesArray] initially", async () => {
        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          invalidBeneficiary.address.substring(2);

        let value = combineAllowedCalls(
          [INTERFACE_IDS.LSP7DigitalAsset, INTERFACE_IDS.ERC20],
          [
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
          ],
          ["0xffffffff", "0xffffffff"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await context.keyManager
          .connect(canOnlyChangePermissions)
          ["execute(bytes)"](payload);

        // prettier-ignore
        const result = await context.universalProfile["getData(bytes32)"](key);
        expect(result).to.equal(value);
      });

      /**
       * TODO: this test pass but behaviour when some zero bytes are stored must be clarified.
       */
      it.skip("should pass when address had 32 x 0 bytes set initially as allowed calls", async () => {
        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          zero32Bytes.address.substring(2);

        let value = combineAllowedCalls(
          [INTERFACE_IDS.LSP7DigitalAsset, INTERFACE_IDS.ERC20],
          [
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
          ],
          ["0xffffffff", "0xffffffff"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await context.keyManager
          .connect(canOnlyChangePermissions)
          ["execute(bytes)"](payload);

        // prettier-ignore
        const result = await context.universalProfile["getData(bytes32)"](key);
        expect(result).to.equal(value);
      });

      /**
       * TODO: this test pass but behaviour when some zero bytes are stored must be clarified.
       */
      it.skip("should pass when address had 40 x 0 bytes set initially as allowed calls", async () => {
        let key =
          ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
          zero40Bytes.address.substring(2);

        let value = combineAllowedCalls(
          [INTERFACE_IDS.LSP7DigitalAsset, INTERFACE_IDS.ERC20],
          [
            "0xffffffffffffffffffffffffffffffffffffffff",
            "0xffffffffffffffffffffffffffffffffffffffff",
          ],
          ["0xffffffff", "0xffffffff"]
        );

        let payload = context.universalProfile.interface.encodeFunctionData(
          "setData(bytes32,bytes)",
          [key, value]
        );

        await context.keyManager
          .connect(canOnlyChangePermissions)
          ["execute(bytes)"](payload);

        // prettier-ignore
        const result = await context.universalProfile["getData(bytes32)"](key);
        expect(result).to.equal(value);
      });

      describe("when changing the list of interface IDs in allowed calls <standard>:ANY:ANY to an invalid value", () => {
        it("should revert with error when value = random bytes", async () => {
          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
            beneficiary.address.substring(2);

          let value = "0xbadbadbadbad";

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await expect(
            context.keyManager
              .connect(canOnlyChangePermissions)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(
              context.keyManager,
              "InvalidEncodedAllowedCalls"
            )
            .withArgs(value);
        });

        it("should revert with error when value = invalid bytes28[CompactBytesArray] (not enough bytes, missing first length byte)", async () => {
          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:AllowedCalls"] +
            beneficiary.address.substring(2);

          let value =
            "0xffffffffffffffffffffffffffffffffffffffffffffffffcafecafe";

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await expect(
            context.keyManager
              .connect(canOnlyChangePermissions)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(
              context.keyManager,
              "InvalidEncodedAllowedCalls"
            )
            .withArgs(value);
        });
      });
    });
  });

  describe("setting Allowed ERC725YDataKeys", () => {
    let canOnlyAddController: SignerWithAddress,
      canOnlyChangePermissions: SignerWithAddress;

    let beneficiary: SignerWithAddress,
      invalidBeneficiary: SignerWithAddress,
      zero32Bytes: SignerWithAddress,
      zero40Bytes: SignerWithAddress;

    before(async () => {
      context = await buildContext();

      canOnlyAddController = context.accounts[1];
      canOnlyChangePermissions = context.accounts[2];

      beneficiary = context.accounts[3];
      invalidBeneficiary = context.accounts[4];
      zero32Bytes = context.accounts[5];
      zero40Bytes = context.accounts[6];

      let permissionKeys = [
        ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
          canOnlyAddController.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
          canOnlyChangePermissions.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:AllowedERC725YDataKeys"] +
          beneficiary.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:AllowedERC725YDataKeys"] +
          invalidBeneficiary.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:AllowedERC725YDataKeys"] +
          zero32Bytes.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:AllowedERC725YDataKeys"] +
          zero40Bytes.address.substring(2),
      ];

      let permissionValues = [
        PERMISSIONS.ADDCONTROLLER,
        PERMISSIONS.CHANGEPERMISSIONS,
        encodeCompactBytesArray([
          ERC725YDataKeys.LSP3["LSP3Profile"],
          // prettier-ignore
          ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Some Custom Profile Data Key")),
        ]),
        "0x11223344",
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000",
      ];

      await setupKeyManager(context, permissionKeys, permissionValues);
    });

    describe("when caller has ADDCONTROLLER", () => {
      describe("when beneficiary had some ERC725Y data keys set under AddressPermissions:AllowedERC725YDataKeys:...", () => {
        it("should fail when adding an extra allowed ERC725Y data key", async () => {
          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:AllowedERC725YDataKeys"] +
            beneficiary.address.substring(2);

          let value = encodeCompactBytesArray([
            ERC725YDataKeys.LSP3["LSP3Profile"],
            // prettier-ignore
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Some Custom Profile Data Key")),
            // prettier-ignore
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Another Custom Data Key")),
          ]);

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await expect(
            context.keyManager
              .connect(canOnlyAddController)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
            .withArgs(canOnlyAddController.address, "CHANGEPERMISSIONS");
        });

        it("should fail when removing an allowed ERC725Y data key", async () => {
          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:AllowedERC725YDataKeys"] +
            beneficiary.address.substring(2);

          let value = encodeCompactBytesArray([
            ERC725YDataKeys.LSP3["LSP3Profile"],
          ]);

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await expect(
            context.keyManager
              .connect(canOnlyAddController)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
            .withArgs(canOnlyAddController.address, "CHANGEPERMISSIONS");
        });

        it("should fail when trying to clear the CompactedBytesArray completely", async () => {
          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:AllowedERC725YDataKeys"] +
            beneficiary.address.substring(2);

          let value = "0x";

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await expect(
            context.keyManager
              .connect(canOnlyAddController)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
            .withArgs(canOnlyAddController.address, "CHANGEPERMISSIONS");
        });

        it("should fail when setting an invalid CompactedBytesArray", async () => {
          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:AllowedERC725YDataKeys"] +
            beneficiary.address.substring(2);

          let value = "0xbadbadbadbad";

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await expect(
            context.keyManager
              .connect(canOnlyAddController)
              ["execute(bytes)"](payload)
          ).to.be.revertedWithCustomError(
            context.keyManager,
            "InvalidEncodedAllowedERC725YDataKeys"
          );
        });
      });

      describe("when beneficiary had no ERC725Y data keys set under AddressPermissions:AllowedERC725YDataKeys:...", () => {
        it("should pass when setting a valid CompactedBytesArray", async () => {
          let newController = ethers.Wallet.createRandom();

          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:AllowedERC725YDataKeys"] +
            newController.address.substr(2);

          let value = encodeCompactBytesArray([
            // prettier-ignore
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes("My Custom Profile Key 1")),
            // prettier-ignore
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes("My Custom Profile Key 2")),
          ]);

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await context.keyManager
            .connect(canOnlyAddController)
            ["execute(bytes)"](payload);

          // prettier-ignore
          const result = await context.universalProfile["getData(bytes32)"](key);
          expect(result).to.equal(value);
        });

        it("should fail when setting an invalid CompactedBytesArray (random bytes)", async () => {
          let newController = ethers.Wallet.createRandom();

          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:AllowedERC725YDataKeys"] +
            newController.address.substr(2);

          let value = "0xbadbadbadbad";

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await expect(
            context.keyManager
              .connect(canOnlyAddController)
              ["execute(bytes)"](payload)
          ).to.be.revertedWithCustomError(
            context.keyManager,
            "InvalidEncodedAllowedERC725YDataKeys"
          );
        });
      });
    });

    describe("when caller has CHANGEPERMISSIONS", () => {
      describe("when beneficiary had some ERC725Y data keys set under AddressPermissions:AllowedERC725YDataKeys:...", () => {
        it("should pass when adding an extra allowed ERC725Y data key", async () => {
          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:AllowedERC725YDataKeys"] +
            beneficiary.address.substring(2);

          let value = encodeCompactBytesArray([
            ERC725YDataKeys.LSP3["LSP3Profile"],
            // prettier-ignore
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Some Custom Profile Data Key")),
            // prettier-ignore
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Another Custom Data Key")),
          ]);

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await context.keyManager
            .connect(canOnlyChangePermissions)
            ["execute(bytes)"](payload);

          // prettier-ignore
          const result = await context.universalProfile["getData(bytes32)"](key);
          expect(result).to.equal(value);
        });

        it("should pass when removing an allowed ERC725Y data key", async () => {
          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:AllowedERC725YDataKeys"] +
            beneficiary.address.substring(2);

          let value = encodeCompactBytesArray([
            ERC725YDataKeys.LSP3["LSP3Profile"],
          ]);

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await context.keyManager
            .connect(canOnlyChangePermissions)
            ["execute(bytes)"](payload);

          // prettier-ignore
          const result = await context.universalProfile["getData(bytes32)"](key);
          expect(result).to.equal(value);
        });

        it("should pass when trying to clear the CompactedBytesArray completely", async () => {
          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:AllowedERC725YDataKeys"] +
            beneficiary.address.substring(2);

          let value = "0x";

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await context.keyManager
            .connect(canOnlyChangePermissions)
            ["execute(bytes)"](payload);

          // prettier-ignore
          const result = await context.universalProfile["getData(bytes32)"](key);
          expect(result).to.equal(value);
        });

        it("should fail when setting an invalid CompactedBytesArray", async () => {
          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:AllowedERC725YDataKeys"] +
            beneficiary.address.substring(2);

          let value = "0xbadbadbadbad";

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await expect(
            context.keyManager
              .connect(canOnlyChangePermissions)
              ["execute(bytes)"](payload)
          ).to.be.revertedWithCustomError(
            context.keyManager,
            "InvalidEncodedAllowedERC725YDataKeys"
          );
        });
      });

      describe("when beneficiary had no ERC725Y data keys set under AddressPermissions:AllowedERC725YDataKeys:...", () => {
        it("should fail and not authorize to add a list of allowed ERC725Y data keys (not authorised)", async () => {
          let newController = ethers.Wallet.createRandom();

          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:AllowedERC725YDataKeys"] +
            newController.address.substr(2);

          let value = encodeCompactBytesArray([
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes("My Custom Key 1")),
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes("My Custom Key 2")),
          ]);

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await expect(
            context.keyManager
              .connect(canOnlyChangePermissions)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
            .withArgs(canOnlyChangePermissions.address, "ADDCONTROLLER");
        });

        it("should fail when setting an invalid CompactedBytesArray", async () => {
          let newController = ethers.Wallet.createRandom();

          let key =
            ERC725YDataKeys.LSP6["AddressPermissions:AllowedERC725YDataKeys"] +
            newController.address.substr(2);

          let value = "0xbadbadbadbad";

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32,bytes)",
            [key, value]
          );

          await expect(
            context.keyManager
              .connect(canOnlyChangePermissions)
              ["execute(bytes)"](payload)
          ).to.be.revertedWithCustomError(
            context.keyManager,
            "InvalidEncodedAllowedERC725YDataKeys"
          );
        });
      });
    });
  });

  describe("setting mixed keys (SETDATA, CHANGE & ADD Permissions)", () => {
    let canSetDataAndAddController: SignerWithAddress,
      canSetDataAndChangePermissions: SignerWithAddress;
    // addresses being used to CHANGE (= edit) permissions
    let addressesToEditPermissions: [SignerWithAddress, SignerWithAddress];

    const allowedERC725YDataKeys = [
      ethers.utils.keccak256(ethers.utils.toUtf8Bytes("My First Key")),
      ethers.utils.keccak256(ethers.utils.toUtf8Bytes("My Second Key")),
      ethers.utils.keccak256(ethers.utils.toUtf8Bytes("My Third Key")),
    ];

    beforeEach(async () => {
      context = await buildContext();

      canSetDataAndAddController = context.accounts[1];
      canSetDataAndChangePermissions = context.accounts[2];

      addressesToEditPermissions = [context.accounts[3], context.accounts[4]];

      const permissionKeys = [
        ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
          context.owner.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
          canSetDataAndAddController.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:AllowedERC725YDataKeys"] +
          canSetDataAndAddController.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
          canSetDataAndChangePermissions.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:AllowedERC725YDataKeys"] +
          canSetDataAndChangePermissions.address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
          addressesToEditPermissions[0].address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
          addressesToEditPermissions[1].address.substring(2),
        ERC725YDataKeys.LSP6["AddressPermissions[]"].length,
      ];

      const permissionValues = [
        ALL_PERMISSIONS,
        combinePermissions(PERMISSIONS.SETDATA, PERMISSIONS.ADDCONTROLLER),
        encodeCompactBytesArray(allowedERC725YDataKeys),
        combinePermissions(PERMISSIONS.SETDATA, PERMISSIONS.CHANGEPERMISSIONS),
        encodeCompactBytesArray(allowedERC725YDataKeys),
        // placeholder permission
        PERMISSIONS.TRANSFERVALUE,
        PERMISSIONS.TRANSFERVALUE,
        // AddressPermissions[].length
        ethers.utils.hexZeroPad(ethers.utils.hexlify(6), 32),
      ];

      await setupKeyManager(context, permissionKeys, permissionValues);
    });

    describe("when setting multiple keys", () => {
      describe("when caller is an address with ALL PERMISSIONS", () => {
        it("(should pass): 2 x keys + add 2 x new permissions", async () => {
          let newControllerKeyOne = ethers.Wallet.createRandom();
          let newControllerKeyTwo = ethers.Wallet.createRandom();

          let keys = [
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes("My First Key")),
            ethers.utils.keccak256(
              ethers.utils.toUtf8Bytes("My SecondKey Key")
            ),
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
              newControllerKeyOne.address.substr(2),
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
              newControllerKeyTwo.address.substr(2),
          ];

          let values = [
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes("My First Value")),
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes("My Second Value")),
            PERMISSIONS.SETDATA,
            PERMISSIONS.SETDATA,
          ];

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32[],bytes[])",
            [keys, values]
          );

          await context.keyManager
            .connect(context.owner)
            ["execute(bytes)"](payload);

          // prettier-ignore
          const fetchedResult = await context.universalProfile["getData(bytes32[])"](keys);
          expect(fetchedResult).to.deep.equal(values);
        });

        it("(should pass): 2 x keys + change 2 x existing permissions", async () => {
          let keys = [
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes("My 1st Key")),
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes("My 2nd Key")),
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
              addressesToEditPermissions[0].address.substring(2),
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
              addressesToEditPermissions[1].address.substring(2),
          ];

          let values = [
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes("My First Value")),
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes("My Second Value")),
            combinePermissions(PERMISSIONS.SETDATA, PERMISSIONS.TRANSFERVALUE),
            combinePermissions(PERMISSIONS.SETDATA, PERMISSIONS.TRANSFERVALUE),
          ];

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32[],bytes[])",
            [keys, values]
          );

          await context.keyManager
            .connect(context.owner)
            ["execute(bytes)"](payload);

          // prettier-ignore
          const fetchedResult = await context.universalProfile["getData(bytes32[])"](keys);
          expect(fetchedResult).to.deep.equal(values);
        });

        it("(should pass): 2 x keys + (add 1 x new permission) + (change 1 x existing permission)", async () => {
          let newControllerKeyOne = ethers.Wallet.createRandom();

          let keys = [
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes("My First Key")),
            ethers.utils.keccak256(
              ethers.utils.toUtf8Bytes("My SecondKey Key")
            ),
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
              newControllerKeyOne.address.substring(2),
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
              addressesToEditPermissions[0].address.substring(2),
          ];

          let values = [
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes("My First Value")),
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes("My Second Value")),
            PERMISSIONS.SIGN,
            combinePermissions(PERMISSIONS.SETDATA, PERMISSIONS.TRANSFERVALUE),
          ];

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32[],bytes[])",
            [keys, values]
          );

          await context.keyManager
            .connect(context.owner)
            ["execute(bytes)"](payload);

          // prettier-ignore
          const fetchedResult = await context.universalProfile["getData(bytes32[])"](keys);
          expect(fetchedResult).to.deep.equal(values);
        });
      });

      describe("when caller is an address with permission SETDATA + ADDCONTROLLER + 3x Allowed ERC725Y data keys", () => {
        it("(should pass): 2 x allowed data keys + add 2 x new controllers", async () => {
          let newControllerKeyOne = ethers.Wallet.createRandom();
          let newControllerKeyTwo = ethers.Wallet.createRandom();

          let keys = [
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes("My First Key")),
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes("My Second Key")),
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
              newControllerKeyOne.address.substr(2),
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
              newControllerKeyTwo.address.substr(2),
          ];

          let values = [
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes("My First Value")),
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes("My Second Value")),
            PERMISSIONS.SETDATA,
            PERMISSIONS.SETDATA,
          ];

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32[],bytes[])",
            [keys, values]
          );

          await context.keyManager
            .connect(canSetDataAndAddController)
            ["execute(bytes)"](payload);

          expect(
            await context.universalProfile["getData(bytes32[])"](keys)
          ).to.deep.equal(values);
        });

        it("(should pass): 2 x allowed data keys + add 2 x new controllers + increment AddressPermissions[].length by +2", async () => {
          let newControllerKeyOne = ethers.Wallet.createRandom();
          let newControllerKeyTwo = ethers.Wallet.createRandom();

          let keys = [
            allowedERC725YDataKeys[0],
            allowedERC725YDataKeys[1],
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
              newControllerKeyOne.address.substr(2),
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
              newControllerKeyTwo.address.substr(2),
            ERC725YDataKeys.LSP6["AddressPermissions[]"].length,
          ];

          let values = [
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes("My First Value")),
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes("My Second Value")),
            PERMISSIONS.SETDATA,
            PERMISSIONS.SETDATA,
            ethers.utils.hexZeroPad(ethers.utils.hexlify(8), 32),
          ];

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32[],bytes[])",
            [keys, values]
          );

          await context.keyManager
            .connect(canSetDataAndAddController)
            ["execute(bytes)"](payload);

          expect(
            await context.universalProfile["getData(bytes32[])"](keys)
          ).to.deep.equal(values);
        });

        it("(should fail): 2 x allowed data keys + add 2 x new controllers + decrement AddressPermissions[].length by -1", async () => {
          let newControllerKeyOne = ethers.Wallet.createRandom();
          let newControllerKeyTwo = ethers.Wallet.createRandom();

          let keys = [
            allowedERC725YDataKeys[0],
            allowedERC725YDataKeys[1],
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
              newControllerKeyOne.address.substr(2),
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
              newControllerKeyTwo.address.substr(2),
            ERC725YDataKeys.LSP6["AddressPermissions[]"].length,
          ];

          let values = [
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes("My First Value")),
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes("My Second Value")),
            PERMISSIONS.SETDATA,
            PERMISSIONS.SETDATA,
            ethers.utils.hexZeroPad(ethers.utils.hexlify(5), 32),
          ];

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32[],bytes[])",
            [keys, values]
          );

          await expect(
            context.keyManager
              .connect(canSetDataAndAddController)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
            .withArgs(canSetDataAndAddController.address, "CHANGEPERMISSIONS");
        });

        it("(should fail): 2 x allowed data keys + edit permissions of 2 x existing controllers", async () => {
          let keys = [
            allowedERC725YDataKeys[0],
            allowedERC725YDataKeys[1],
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
              addressesToEditPermissions[0].address.substring(2),
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
              addressesToEditPermissions[1].address.substring(2),
          ];

          let values = [
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes("My First Value")),
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes("My Second Value")),
            combinePermissions(PERMISSIONS.SETDATA, PERMISSIONS.TRANSFERVALUE),
            combinePermissions(PERMISSIONS.SETDATA, PERMISSIONS.TRANSFERVALUE),
          ];

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32[],bytes[])",
            [keys, values]
          );

          await expect(
            context.keyManager
              .connect(canSetDataAndAddController)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
            .withArgs(canSetDataAndAddController.address, "CHANGEPERMISSIONS");
        });

        it("(should fail): 2 x allowed data keys + (add 1 x new controller) + (edit permission of 1 x existing controller)", async () => {
          let newControllerKeyOne = ethers.Wallet.createRandom();

          let keys = [
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes("My First Key")),
            ethers.utils.keccak256(
              ethers.utils.toUtf8Bytes("My SecondKey Key")
            ),
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
              newControllerKeyOne.address.substr(2),
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
              addressesToEditPermissions[0].address.substr(2),
          ];

          let values = [
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes("My First Value")),
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes("My Second Value")),
            PERMISSIONS.SIGN,
            combinePermissions(PERMISSIONS.SETDATA, PERMISSIONS.TRANSFERVALUE),
          ];

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32[],bytes[])",
            [keys, values]
          );

          await expect(
            context.keyManager
              .connect(canSetDataAndAddController)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
            .withArgs(canSetDataAndAddController.address, "CHANGEPERMISSIONS");
        });

        it("(should fail): 1 x allowed data key + 1 x NOT allowed data key + 2 x new controllers", async () => {
          let newControllerKeyOne = ethers.Wallet.createRandom();
          let newControllerKeyTwo = ethers.Wallet.createRandom();

          const NotAllowedERC725YDataKey = ethers.utils.keccak256(
            ethers.utils.toUtf8Bytes("Not Allowed Data Key")
          );

          // prettier-ignore
          let dataKeys = [
            allowedERC725YDataKeys[0],
            NotAllowedERC725YDataKey,
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
              newControllerKeyOne.address.substr(2),
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
              newControllerKeyTwo.address.substr(2),
          ];

          // prettier-ignore
          let dataValues = [
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes("My First Value")),
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes("Random data for not allowed value")),
            PERMISSIONS.SETDATA,
            PERMISSIONS.SETDATA,
          ];

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32[],bytes[])",
            [dataKeys, dataValues]
          );

          await expect(
            context.keyManager
              .connect(canSetDataAndAddController)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(
              context.keyManager,
              "NotAllowedERC725YDataKey"
            )
            .withArgs(
              canSetDataAndAddController.address,
              NotAllowedERC725YDataKey
            );
        });
      });

      describe("when caller is an address with permission SETDATA + CHANGEPERMISSIONS + 3x Allowed ERC725Y data keys", () => {
        it("(should pass): 2 x allowed data keys + remove 2 x addresses with permissions + decrement AddressPermissions[].length by -2", async () => {
          let keys = [
            allowedERC725YDataKeys[0],
            allowedERC725YDataKeys[1],
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
              addressesToEditPermissions[0].address.substring(2),
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
              addressesToEditPermissions[1].address.substring(2),
            ERC725YDataKeys.LSP6["AddressPermissions[]"].length,
          ];

          let values = [
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes("My First Value")),
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes("My Second Value")),
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            ethers.utils.hexZeroPad(ethers.utils.hexlify(4), 32),
          ];

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32[],bytes[])",
            [keys, values]
          );

          await context.keyManager
            .connect(canSetDataAndChangePermissions)
            ["execute(bytes)"](payload);

          expect(
            await context.universalProfile["getData(bytes32[])"](keys)
          ).to.deep.equal(values);
        });

        it("(should pass): 2 x allowed data keys + edit permissions of 2 x existing controllers", async () => {
          let keys = [
            allowedERC725YDataKeys[0],
            allowedERC725YDataKeys[1],
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
              addressesToEditPermissions[0].address.substring(2),
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
              addressesToEditPermissions[1].address.substring(2),
          ];

          let values = [
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes("My First Value")),
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes("My Second Value")),
            combinePermissions(PERMISSIONS.SETDATA, PERMISSIONS.TRANSFERVALUE),
            combinePermissions(PERMISSIONS.SETDATA, PERMISSIONS.TRANSFERVALUE),
          ];

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32[],bytes[])",
            [keys, values]
          );

          await context.keyManager
            .connect(canSetDataAndChangePermissions)
            ["execute(bytes)"](payload);

          expect(
            await context.universalProfile["getData(bytes32[])"](keys)
          ).to.deep.equal(values);
        });

        it("(should fail): 2 x allowed data keys + add 2 x new controllers", async () => {
          let newControllerKeyOne = ethers.Wallet.createRandom();
          let newControllerKeyTwo = ethers.Wallet.createRandom();

          let keys = [
            allowedERC725YDataKeys[0],
            allowedERC725YDataKeys[1],
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
              newControllerKeyOne.address.substr(2),
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
              newControllerKeyTwo.address.substr(2),
          ];

          let values = [
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes("My First Value")),
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes("My Second Value")),
            PERMISSIONS.SETDATA,
            PERMISSIONS.SETDATA,
          ];

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32[],bytes[])",
            [keys, values]
          );

          await expect(
            context.keyManager
              .connect(canSetDataAndChangePermissions)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
            .withArgs(canSetDataAndChangePermissions.address, "ADDCONTROLLER");
        });

        it("(should fail): 2 x allowed data keys + increment AddressPermissions[].length by +1", async () => {
          let keys = [
            allowedERC725YDataKeys[0],
            allowedERC725YDataKeys[1],
            ERC725YDataKeys.LSP6["AddressPermissions[]"].length,
          ];

          let values = [
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes("My First Value")),
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes("My Second Value")),
            ethers.utils.hexZeroPad(ethers.utils.hexlify(7), 32),
          ];

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32[],bytes[])",
            [keys, values]
          );

          await expect(
            context.keyManager
              .connect(canSetDataAndChangePermissions)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
            .withArgs(canSetDataAndChangePermissions.address, "ADDCONTROLLER");
        });

        it("(should fail): 2 x allowed data keys + (add 1 x new permission) + (edit permission of 1 x existing controller)", async () => {
          let newControllerKeyOne = ethers.Wallet.createRandom();

          let keys = [
            allowedERC725YDataKeys[0],
            allowedERC725YDataKeys[1],
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
              newControllerKeyOne.address.substr(2),
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
              addressesToEditPermissions[0].address.substr(2),
          ];

          let values = [
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes("My First Value")),
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes("My Second Value")),
            PERMISSIONS.SIGN,
            combinePermissions(PERMISSIONS.SETDATA, PERMISSIONS.TRANSFERVALUE),
          ];

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32[],bytes[])",
            [keys, values]
          );

          await expect(
            context.keyManager
              .connect(canSetDataAndChangePermissions)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(context.keyManager, "NotAuthorised")
            .withArgs(canSetDataAndChangePermissions.address, "ADDCONTROLLER");
        });

        it("(should fail): edit permissions of 2 x existing controllers + (set 1 x allowed data key) + (set 1 x NOT allowed data key)", async () => {
          const NotAllowedERC725YDataKey = ethers.utils.keccak256(
            ethers.utils.toUtf8Bytes("Not Allowed Data Key")
          );

          let keys = [
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
              addressesToEditPermissions[0].address.substring(2),
            ERC725YDataKeys.LSP6["AddressPermissions:Permissions"] +
              addressesToEditPermissions[1].address.substring(2),
            allowedERC725YDataKeys[0],
            NotAllowedERC725YDataKey,
          ];

          let values = [
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes("My First Value")),
            combinePermissions(PERMISSIONS.SETDATA, PERMISSIONS.TRANSFERVALUE),
            combinePermissions(PERMISSIONS.SETDATA, PERMISSIONS.TRANSFERVALUE),
            combinePermissions(PERMISSIONS.SETDATA, PERMISSIONS.TRANSFERVALUE),
            ethers.utils.hexlify(
              ethers.utils.toUtf8Bytes("Random data for not allowed value")
            ),
          ];

          let payload = context.universalProfile.interface.encodeFunctionData(
            "setData(bytes32[],bytes[])",
            [keys, values]
          );

          await expect(
            context.keyManager
              .connect(canSetDataAndChangePermissions)
              ["execute(bytes)"](payload)
          )
            .to.be.revertedWithCustomError(
              context.keyManager,
              "NotAllowedERC725YDataKey"
            )
            .withArgs(
              canSetDataAndChangePermissions.address,
              NotAllowedERC725YDataKey
            );
        });
      });
    });
  });
};
