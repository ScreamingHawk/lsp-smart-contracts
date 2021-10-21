// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

// modules
import "../submodules/ERC725/implementations/contracts/ERC725/ERC725AccountCore.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Storage.sol";

// libraries
import "../submodules/ERC725/implementations/contracts/Utils/ERC725Utils.sol";

/**
 * @title Core implementation of a LUKSO's Universal Profile based on LSP3
 * @author Fabian Vogelsteller <fabian@lukso.network>
 * @dev Implementation of the ERC725Account + LSP1 universalReceiver
 */
abstract contract UniversalProfileCore is ERC165Storage, ERC725AccountCore {
    using ERC725Utils for ERC725Y;

    bytes32[] public dataKeys;

    /* non-standard public functions */

    function allDataKeys() public view returns (bytes32[] memory) {
        return dataKeys;
    }

    function setData(bytes32[] memory _keys, bytes[] memory _values)
        public
        virtual
        override
        onlyOwner
    {
        require(_keys.length == _values.length, "Keys length not equal to values length");
        for (uint256 ii = 0; ii < _keys.length; ii++) {
            if (store[_keys[ii]].length == 0) {
                dataKeys.push(_keys[ii]);
            }
            _setData(_keys[ii], _values[ii]);
        }
    }
}