public with sharing class AdVic_CheckoutAccountSwitcherController {

    public class AccountAddress {
        @AuraEnabled
        public Boolean isDefault {get;set;}
        @AuraEnabled
        public String accountId {get;set;}
        @AuraEnabled
        public String accountName {get;set;}
        @AuraEnabled
        public String address {get;set;}
        @AuraEnabled
        public String city {get;set;}
        @AuraEnabled
        public String state {get;set;}
        @AuraEnabled
        public String zip {get;set;}
        @AuraEnabled
        public String country {get;set;}
        @AuraEnabled
        public List<Map<String,String>> customFields {get;set;}
    }

    @AuraEnabled
    public static List<AccountAddress> getAddresses(Id cartCheckoutSessionId, String accountNameFieldApiName, String fieldApiNames){
        List<AccountAddress> addresses = new List<AccountAddress>();

        CartCheckoutSession cartCheckoutSession = [SELECT Id, WebCartId FROM CartCheckoutSession WHERE Id = :cartCheckoutSessionId];
        WebCart cart = [SELECT Id, AccountId, OwnerId, Ship_To_Account__c FROM WebCart WHERE Id = :cartCheckoutSession.WebCartId];
        Account cartAccount = [SELECT Id, ShippingAddress FROM Account WHERE Id = :cart.AccountId];

        Set<Id> relatedAccounts = new Set<Id>();
        if(cart.AccountId != null){
            relatedAccounts.add(cart.AccountId);
        }

        if(cart.Ship_To_Account__c != null){
            relatedAccounts.add(cart.Ship_To_Account__c);
        }

        for (Account ac : [SELECT Id FROM Account WHERE ParentId = :cartAccount.Id]) {
            relatedAccounts.add(ac.Id);
        }

        // Convert Set<Id> to List<String> and then join
        List<String> idStrings = new List<String>();
        for(Id accountId : relatedAccounts) {
            idStrings.add('\'' + String.valueOf(accountId) + '\'');
        }
        String ids = String.join(idStrings, ',');

        String formattedFieldApiNames = formatFieldApiNames(fieldApiNames + ', ' + accountNameFieldApiName);

        String query = 'SELECT Id, ' + formattedFieldApiNames + ', ShippingStreet, ShippingCity, ShippingState, ShippingPostalCode, ShippingCountry FROM Account WHERE Id IN (' + ids + ')';

        System.debug('query: ' + query);

        //fire the query
        List<Account> relatedAccountsList = Database.query(query);
        
        for (Account a : relatedAccountsList) {
            AccountAddress address = new AccountAddress();
            
            //check if the cart has a Ship_To_Account__c set, if so, use that to find the default address
            if(cart.Ship_To_Account__c != null){
                address.isDefault = a.Id == cart.Ship_To_Account__c;
            }
            else{
                address.isDefault = a.Id == cart.AccountId;
            }

            address.accountId = a.Id;
            //set account name dynamically
            address.accountName = String.valueOf(a.get(accountNameFieldApiName));
            
            //set standard fields
            address.address = a.ShippingStreet != null ? a.ShippingStreet : '';
            address.city = a.ShippingCity != null ? a.ShippingCity : '';
            address.state = a.ShippingState != null ? a.ShippingState : '';
            address.zip = a.ShippingPostalCode != null ? a.ShippingPostalCode : '';
            address.country = a.ShippingCountry != null ? a.ShippingCountry : '';
            

            //initialize custom fields map
            address.customFields = new List<Map<String,String>>();

            //set custom fields
            if(fieldApiNames != null && !String.isBlank(fieldApiNames)){
                List<String> fieldList = fieldApiNames.trim().split(',');

                Schema.SObjectType accountType = Schema.getGlobalDescribe().get('Account');
                Map<String, Schema.SObjectField> originalFieldMap = accountType.getDescribe().fields.getMap();
                Map<String, Schema.SObjectField> caseInsensitiveFieldMap = new Map<String, Schema.SObjectField>();

                for(String key : originalFieldMap.keySet()){
                    caseInsensitiveFieldMap.put(key.toLowerCase().trim(), originalFieldMap.get(key));
                }

                for(String fieldName : fieldList){
                    Object fieldValue = a.get(fieldName.trim());
                    if(fieldValue != null && (fieldName.toLowerCase().trim() != accountNameFieldApiName.toLowerCase().trim())){
                        Map<String,String> detail = new Map<String,String>();

                        if(caseInsensitiveFieldMap.containsKey(fieldName.trim().toLowerCase())){
                            Schema.DescribeFieldResult fieldResult = caseInsensitiveFieldMap.get(fieldName.trim().toLowerCase()).getDescribe();
                            detail.put('label', fieldResult.getLabel());
                        }
                        else{
                            detail.put('label', fieldName.trim());
                        }
                        
                        detail.put('name', fieldName.trim());
                        detail.put('value', String.valueOf(fieldValue));
                        address.customFields.add(detail);
                    }
                }
            }

            addresses.add(address);
        }            

        return addresses;
    }

    @AuraEnabled
    public static String setDefaultAddress(Id cartCheckoutSessionId, Id accountId){
        try{
            CartCheckoutSession cartCheckoutSession = [SELECT Id, WebCartId FROM CartCheckoutSession WHERE Id = :cartCheckoutSessionId];
            WebCart cart = [SELECT Id, Ship_To_Account__c FROM WebCart WHERE Id = :cartCheckoutSession.WebCartId];
            Account oldShipToAccount = [SELECT Id FROM Account WHERE Id = :cart.Ship_To_Account__c];
            Account newShipToAccount = [SELECT Id FROM Account WHERE Id = :accountId];

            if(oldShipToAccount.Id != newShipToAccount.Id){
                cart.Ship_To_Account__c = newShipToAccount.Id;
                update cart;
            }

            return 'success';
        }
        catch(Exception e){
            return e.getMessage();
        }
    }

    @testVisible
    private static String formatFieldApiNames(String fieldApiNames){
        if(fieldApiNames == null) {
            return '';
        }
        
        fieldApiNames = fieldApiNames.toLowerCase().trim();
        Set<String> uniqueFieldApiNames = new Set<String>();
        List<String> fieldApiNameList = fieldApiNames.split(',');
    
        for(String fieldApiName : fieldApiNameList){
            uniqueFieldApiNames.add(fieldApiName.trim());
        }
    
        return String.join(uniqueFieldApiNames, ', ');
    }
}