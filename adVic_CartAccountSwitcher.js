import { LightningElement, track, api } from 'lwc';
import checkoutDetailsMock from './checkoutDetailsMock'; // adjust the path as necessary
import getAddresses from '@salesforce/apex/AdVic_CheckoutAccountSwitcherController.getAddresses';
import setDefaultAddress from '@salesforce/apex/AdVic_CheckoutAccountSwitcherController.setDefaultAddress';
import { getSessionContext } from 'commerce/contextApi';

import currentAddressLabel from '@salesforce/label/c.AdVic_CurrentAddress';
import changeAddressLabel from '@salesforce/label/c.AdVic_ChangeAddress';
import addressSearchLabel from '@salesforce/label/c.AdVic_AddressSearch';

export default class AdVic_CartAccountSwitcher extends LightningElement {

    labels = {
        currentAddress: currentAddressLabel,
        changeAddress: changeAddressLabel,
        addressSearch: addressSearchLabel
    }

    _sessionContext;
    _addresses = [];
    _checkoutDetails;
    _accountNameFieldApiName;
    _fieldApiNames;
    _dataFetched = false;
    _propertyStates = {
        accountNameFieldApiName_isSet: false,
        fieldApiNames_isSet: false,
        checkoutDetails_isSet: false,
    };

    @track filter = '';
    @track selectedAddress = {};
    @track loading = true;
    @track filteredAddresses = [];
    @track showChangeAddress = false;

    @api showLabels = false;

    @api 
    set accountNameFieldApiName(value) {
        this._accountNameFieldApiName = value;
        this._propertyStates.accountNameFieldApiName_isSet = true;
        this.fetchAddressData();
    }
    get accountNameFieldApiName() {
        return this._accountNameFieldApiName;
    }

    @api 
    set fieldApiNames(value) {
        this._fieldApiNames = value;
        this._propertyStates.fieldApiNames_isSet = true;
        this.fetchAddressData();
    }
    get fieldApiNames() {
        return this._fieldApiNames;
    }

    @api
    set checkoutDetails(value) {
        if(value) {
            this._checkoutDetails = value;
            this._propertyStates.checkoutDetails_isSet = true;
            this.fetchAddressData();
        }
    }
    get checkoutDetails() {
        return this._checkoutDetails;
    }

    get selectedAddressSectionClass() {
        return 'selected-address-section' + (this.showChangeAddress ? '' : '-only');
    }

    async connectedCallback() {
        this._sessionContext = await getSessionContext();
        
        //mock the checkout data in experience builder
        if(this._sessionContext.isPreview) {
            this._checkoutDetails = checkoutDetailsMock;
            this._propertyStates.checkoutDetails_isSet = true;
            this.fetchAddressData();
        }
    }

    updateFilter(event) {
        this.filter = event.target.value;
        this.filterAddresses();
    }

    filterAddresses() {
        if(this.filter === '') {
            this.filteredAddresses = this._addresses;
            return
        }
        this.filteredAddresses = this._addresses.filter(address => {
            if(address.address.toLowerCase().includes(this.filter.toLowerCase()) || address.city.toLowerCase().includes(this.filter.toLowerCase()) || address.state.toLowerCase().includes(this.filter.toLowerCase()) || address.zip.toLowerCase().includes(this.filter.toLowerCase()) || address.country.toLowerCase().includes(this.filter.toLowerCase())) {
                return address;
            }
        });
    }

    fetchAddressData(){
        if (!this._dataFetched && this._propertyStates.accountNameFieldApiName_isSet && this._propertyStates.fieldApiNames_isSet && this._propertyStates.checkoutDetails_isSet) {
            getAddresses({ cartCheckoutSessionId: this._checkoutDetails.checkoutId, accountNameFieldApiName: this._accountNameFieldApiName, fieldApiNames: this._fieldApiNames })
            .then(result => {
                this.dataFetched = true;
                this.parseAddressData(result);
            })
            .catch(error => {
                console.log('error: ' + JSON.stringify(error));
            })
        }
    }

    parseAddressData(result){
        let addresses = [];
        result.forEach(address => {
            const hasCustomFields = Object.keys(address.customFields).length > 0;
            if (address.isDefault) {
                this.selectedAddress = {
                    isDefault: address.isDefault,
                    accountId: address.accountId,
                    accountName: address.accountName,
                    address: address.address,
                    city: address.city,
                    state: address.state,
                    zip: address.zip,
                    country: address.country,
                    hasCustomFields: hasCustomFields,
                    customFields: address.customFields
                };
            } else {
                addresses.push({
                    isDefault: address.isDefault,
                    accountId: address.accountId,
                    accountName: address.accountName,
                    address: address.address,
                    city: address.city,
                    state: address.state,
                    zip: address.zip,
                    country: address.country,
                    hasCustomFields: hasCustomFields,
                    customFields: address.customFields
                });
            }
        });
        this._addresses = addresses;

        if(this._addresses.length > 0) {
            this.showChangeAddress = true;
        }

        this.filterAddresses();
        this.loading = false;
    }

    async handleAddressOptionClick(event) {
        this.loading = true;

        const selectedId = event.currentTarget.dataset.value;

        // Find the selected address
        const newlySelectedAddress = this._addresses.find(address => address.accountId === selectedId);

        await setDefaultAddress({ cartCheckoutSessionId: this._checkoutDetails.checkoutId, accountId: newlySelectedAddress.accountId })
        .catch(error => {
            newlySelectedAddress = null;
        });

        if (newlySelectedAddress) {
            // Add the currently selected address back to the addresses array
            if (this.selectedAddress && this.selectedAddress.accountId) {
                this._addresses.push({
                    isDefault: false,  // Set isDefault to false as it's no longer the selected address
                    accountId: this.selectedAddress.accountId,
                    accountName: this.selectedAddress.accountName,
                    address: this.selectedAddress.address,
                    city: this.selectedAddress.city,
                    state: this.selectedAddress.state,
                    zip: this.selectedAddress.zip,
                    country: this.selectedAddress.country,
                    hasCustomFields: this.selectedAddress.hasCustomFields,
                    customFields: this.selectedAddress.customFields
                });
            }

            // Update the selected address
            this.selectedAddress = {
                isDefault: true, // Set isDefault to true as it's now the selected address
                accountId: newlySelectedAddress.accountId,
                accountName: newlySelectedAddress.accountName,
                address: newlySelectedAddress.address,
                city: newlySelectedAddress.city,
                state: newlySelectedAddress.state,
                zip: newlySelectedAddress.zip,
                country: newlySelectedAddress.country,
                hasCustomFields: newlySelectedAddress.hasCustomFields,
                customFields: newlySelectedAddress.customFields
            };

            // Remove the newly selected address from the addresses array
            this._addresses = this._addresses.filter(address => address.accountId !== selectedId);
        }

        this.filter = ''; // reset filter to empty string
        this.filterAddresses();
        this.loading = false;
    }
}