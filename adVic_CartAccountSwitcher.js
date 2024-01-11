import { LightningElement, track, api, wire } from 'lwc';
import checkoutDetailsMock from './checkoutDetailsMock'; // adjust the path as necessary
import getAddresses from '@salesforce/apex/AdVic_CheckoutAccountSwitcherController.getAddresses';
import setDefaultAddress from '@salesforce/apex/AdVic_CheckoutAccountSwitcherController.setDefaultAddress';

export default class AdVic_CartAccountSwitcher extends LightningElement {

    _addresses = [];
    _checkoutDetails;

    @track filter = '';
    @track selectedAddress = {};
    @track loading = true;

    @api 
    set checkoutDetails(value) {
        // this._checkoutDetails = value;
        // this.fetchAddressData();
    }
    get checkoutDetails() {
        // return this._checkoutDetails;
    }

    renderedCallback() {
        this.setupEventListener();
    }

    setupEventListener() {
        const addressInput = this.template.querySelector('.address-input');
        if (addressInput) {
            addressInput.addEventListener('input', this.updateFilter.bind(this));
        }
    }

    updateFilter(event) {
        this.filter = event.target.value;
    }

    get filteredAddresses() {
        return this._addresses.filter(address => {
            if(address.address.toLowerCase().includes(this.filter.toLowerCase()) || address.city.toLowerCase().includes(this.filter.toLowerCase()) || address.state.toLowerCase().includes(this.filter.toLowerCase()) || address.zip.toLowerCase().includes(this.filter.toLowerCase()) || address.country.toLowerCase().includes(this.filter.toLowerCase())) {
                return address;
            }
        });
    }

    connectedCallback() {
        this._checkoutDetails = checkoutDetailsMock;
        this.fetchAddressData();
    }

    fetchAddressData(){
        console.log('ID: ' + this._checkoutDetails.checkoutId);
        getAddresses({ cartCheckoutSessionId: this._checkoutDetails.checkoutId })
        .then(result => {
            this.parseAddressData(result);
        })
        .catch(error => {
            console.log('error: ' + JSON.stringify(error));
        })
    }

    parseAddressData(result){
        console.log('result: ' + JSON.stringify(result));
        let addresses = [];
        result.forEach(address => {
            if (address.isDefault) {
                this.selectedAddress = {
                    isDefault: address.isDefault,
                    accountId: address.accountId,
                    address: address.address,
                    city: address.city,
                    state: address.state,
                    zip: address.zip,
                    country: address.country
                };
            } else {
                addresses.push({
                    isDefault: address.isDefault,
                    accountId: address.accountId,
                    address: address.address,
                    city: address.city,
                    state: address.state,
                    zip: address.zip,
                    country: address.country
                });
            }
        });
        this._addresses = addresses;
        this.loading = false;
    }

    async handleAddressOptionClick(event) {
        this.loading = true;

        const selectedId = event.currentTarget.dataset.value;

        console.log('selectedId: ' + selectedId);
        // Find the selected address
        const newlySelectedAddress = this._addresses.find(address => address.accountId === selectedId);

        await setDefaultAddress({ cartCheckoutSessionId: this._checkoutDetails.checkoutId, accountId: newlySelectedAddress.accountId })
        .catch(error => {
            newlySelectedAddress = null;
            console.log('error: ' + JSON.stringify(error));
        });

        if (newlySelectedAddress) {
            // Add the currently selected address back to the addresses array
            if (this.selectedAddress && this.selectedAddress.accountId) {
                this._addresses.push({
                    isDefault: false,  // Set isDefault to false as it's no longer the selected address
                    accountId: this.selectedAddress.accountId,
                    address: this.selectedAddress.address,
                    city: this.selectedAddress.city,
                    state: this.selectedAddress.state,
                    zip: this.selectedAddress.zip,
                    country: this.selectedAddress.country
                });
            }

            // Update the selected address
            this.selectedAddress = {
                isDefault: true, // Set isDefault to true as it's now the selected address
                accountId: newlySelectedAddress.accountId,
                address: newlySelectedAddress.address,
                city: newlySelectedAddress.city,
                state: newlySelectedAddress.state,
                zip: newlySelectedAddress.zip,
                country: newlySelectedAddress.country
            };

            // Remove the newly selected address from the addresses array
            this._addresses = this._addresses.filter(address => address.accountId !== selectedId);
        }

        this.filter = ''; // reset filter to empty string
        this.loading = false;
    }
}