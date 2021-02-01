import Component from '@ember/component';
import {computed} from '@ember/object';
import {reads} from '@ember/object/computed';
import {inject as service} from '@ember/service';
import {task} from 'ember-concurrency';

const MAILGUN = {label: 'Mailgun', value: 'mailgun'};
const AWS_SES = {label: 'AWS SES', value: 'ses'};
const BULK_EMAIL_PROVIDERS = [MAILGUN, AWS_SES];

const US = {flag: '🇺🇸', name: 'US', baseUrl: 'https://api.mailgun.net/v3'};
const EU = {flag: '🇪🇺', name: 'EU', baseUrl: 'https://api.eu.mailgun.net/v3'};
const MAILGUN_REGIONS = [US, EU];

const SES_REGIONS = [
    {label: 'us-east-1', value: 'us-east-1'},
    {label: 'us-east-2', value: 'us-east-2'},
    {label: 'us-west-1', value: 'us-west-1'},
    {label: 'us-west-2', value: 'us-west-2'},
    {label: 'us-south-1', value: 'us-south-1'},
    {label: 'ap-south-1', value: 'ap-south-1'},
    {label: 'ap-northeast-1', value: 'ap-northeast-1'},
    {label: 'ap-northeast-2', value: 'ap-northeast-2'},
    {label: 'ap-southeast-1', value: 'ap-southeast-1'},
    {label: 'ap-southeast-2', value: 'ap-southeast-2'},
    {label: 'ca-central-1', value: 'ca-central-1'},
    {label: 'eu-central-1', value: 'eu-central-1'},
    {label: 'eu-west-1', value: 'eu-west-1'},
    {label: 'eu-west-2', value: 'eu-west-2'},
    {label: 'eu-west-3', value: 'eu-west-3'},
    {label: 'eu-north-1', value: 'eu-north-1'},
    {label: 'me-south-3', value: 'me-south-3'},
    {label: 'sa-south-1', value: 'sa-south-1'}
];

const CURRENCIES = [
    {
        label: 'USD - US Dollar', value: 'usd', symbol: '$'
    },
    {
        label: 'AUD - Australian Dollar', value: 'aud', symbol: '$'
    },
    {
        label: 'CAD - Canadian Dollar', value: 'cad', symbol: '$'
    },
    {
        label: 'EUR - Euro', value: 'eur', symbol: '€'
    },
    {
        label: 'GBP - British Pound', value: 'gbp', symbol: '£'
    },
    {
        label: 'INR - Indian Rupee', value: 'inr', symbol: '₹'
    }
];

const REPLY_ADDRESSES = [
    {
        label: 'Newsletter email address',
        value: 'newsletter'
    },
    {
        label: 'Support email address',
        value: 'support'
    }
];

export default Component.extend({
    feature: service(),
    config: service(),
    mediaQueries: service(),
    ghostPaths: service(),
    ajax: service(),
    settings: service(),

    currencies: null,
    replyAddresses: null,
    showFromAddressConfirmation: false,
    showSupportAddressConfirmation: false,
    showPortalSettings: false,
    showEmailDesignSettings: false,
    stripePlanInvalidAmount: false,
    _scratchStripeYearlyAmount: null,
    _scratchStripeMonthlyAmount: null,
    showLeaveSettingsModal: false,

    // passed in actions
    setStripeConnectIntegrationTokenSetting() {},

    defaultContentVisibility: reads('settings.defaultContentVisibility'),

    stripeDirect: reads('config.stripeDirect'),

    // TODO: Learn what is the relationship between config and settings?
    mailgunIsConfigured: reads('config.mailgunIsConfigured'),

    allowSelfSignup: reads('settings.membersAllowFreeSignup'),
    emailTrackOpens: reads('settings.emailTrackOpens'),

    /** OLD **/
    stripeDirectPublicKey: reads('settings.stripePublishableKey'),
    stripeDirectSecretKey: reads('settings.stripeSecretKey'),

    stripeConnectAccountId: reads('settings.stripeConnectAccountId'),
    stripeConnectAccountName: reads('settings.stripeConnectDisplayName'),
    stripeConnectLivemode: reads('settings.stripeConnectLivemode'),

    portalSettingsBorderColor: reads('settings.accentColor'),

    selectedReplyAddress: computed('settings.membersReplyAddress', function () {
        return REPLY_ADDRESSES.findBy('value', this.get('settings.membersReplyAddress'));
    }),

    selectedCurrency: computed('stripePlans.monthly.currency', function () {
        return CURRENCIES.findBy('value', this.get('stripePlans.monthly.currency'));
    }),

    selectedBulkEmailProvider: computed('settings.bulkEmailProvider', function () {
        return BULK_EMAIL_PROVIDERS.findBy('value', this.get('settings.bulkEmailProvider'));
    }),

    selectedSesRegion: computed('settings.sesRegion', function () {
        return SES_REGIONS.findBy('value', this.get('settings.sesRegion'));
    }),

    disableUpdateFromAddressButton: computed('fromAddress', function () {
        const savedFromAddress = this.get('settings.membersFromAddress') || '';
        if (!savedFromAddress.includes('@') && this.blogDomain) {
            return !this.fromAddress || (this.fromAddress === `${savedFromAddress}@${this.blogDomain}`);
        }
        return !this.fromAddress || (this.fromAddress === savedFromAddress);
    }),

    disableUpdateSupportAddressButton: computed('supportAddress', function () {
        const savedSupportAddress = this.get('settings.membersSupportAddress') || '';
        if (!savedSupportAddress.includes('@') && this.blogDomain) {
            return !this.supportAddress || (this.supportAddress === `${savedSupportAddress}@${this.blogDomain}`);
        }
        return !this.supportAddress || (this.supportAddress === savedSupportAddress);
    }),

    blogDomain: computed('config.blogDomain', function () {
        let blogDomain = this.config.blogDomain || '';
        const domainExp = blogDomain.replace('https://', '').replace('http://', '').match(new RegExp('^([^/:?#]+)(?:[/:?#]|$)', 'i'));
        return (domainExp && domainExp[1]) || '';
    }),

    mailgunRegion: computed('settings.mailgunBaseUrl', function () {
        if (!this.settings.get('mailgunBaseUrl')) {
            return US;
        }

        return MAILGUN_REGIONS.find((region) => {
            return region.baseUrl === this.settings.get('mailgunBaseUrl');
        });
    }),

    stripePlans: computed('settings.stripePlans', function () {
        const plans = this.settings.get('stripePlans');
        const monthly = plans.find(plan => plan.interval === 'month');
        const yearly = plans.find(plan => plan.interval === 'year' && plan.name !== 'Complimentary');

        return {
            monthly: {
                amount: parseInt(monthly.amount) / 100 || 5,
                currency: monthly.currency
            },
            yearly: {
                amount: parseInt(yearly.amount) / 100 || 50,
                currency: yearly.currency
            }
        };
    }),

    mailgunSettings: computed('settings.{mailgunBaseUrl,mailgunApiKey,mailgunDomain}', function () {
        return {
            apiKey: this.get('settings.mailgunApiKey') || '',
            domain: this.get('settings.mailgunDomain') || '',
            baseUrl: this.get('settings.mailgunBaseUrl') || ''
        };
    }),

    sesSettings: computed('settings.{sesAccessKeyId,sesSecretAccessKey,sesRegion}', function () {
        return {
            accessKeyId: this.get('settings.sesAccessKeyId') || '',
            secretAccessKey: this.get('settings.sesSecretAccessKey') || '',
            region: this.get('settings.sesRegion') || 'us-east-1'
        };
    }),

    init() {
        this._super(...arguments);
        this.set('bulkEmailProviders', BULK_EMAIL_PROVIDERS);
        this.set('sesRegions', SES_REGIONS);
        this.set('mailgunRegions', [US, EU]);
        this.set('currencies', CURRENCIES);
        this.set('replyAddresses', REPLY_ADDRESSES);
    },

    actions: {
        toggleFromAddressConfirmation() {
            this.toggleProperty('showFromAddressConfirmation');
        },

        closePortalSettings() {
            const changedAttributes = this.settings.changedAttributes();
            if (changedAttributes && Object.keys(changedAttributes).length > 0) {
                this.set('showLeaveSettingsModal', true);
            } else {
                this.set('showPortalSettings', false);
            }
        },

        closeEmailDesignSettings() {
            this.set('showEmailDesignSettings', false);
        },

        setDefaultContentVisibility(value) {
            this.setDefaultContentVisibility(value);
        },

        setBulkEmailProvider(event) {
            const newBulkEmailProvider = event.value;
            this.set('settings.bulkEmailProvider', newBulkEmailProvider);
        },

        setMailgunDomain(event) {
            this.set('settings.mailgunDomain', event.target.value);
            if (!this.get('settings.mailgunBaseUrl')) {
                this.set('settings.mailgunBaseUrl', this.mailgunRegion.baseUrl);
            }
        },

        setMailgunApiKey(event) {
            this.set('settings.mailgunApiKey', event.target.value);
            if (!this.get('settings.mailgunBaseUrl')) {
                this.set('settings.mailgunBaseUrl', this.mailgunRegion.baseUrl);
            }
        },

        setMailgunRegion(region) {
            this.set('settings.mailgunBaseUrl', region.baseUrl);
        },

        setSesAccessKeyId(event) {
            this.set('settings.sesAccessKeyId', event.target.value);
        },

        setSesSecretAccessKey(event) {
            this.set('settings.sesSecretAccessKey', event.target.value);
        },

        setSesRegion(event) {
            this.set('settings.sesRegion', event.value);
        },

        setFromAddress(fromAddress) {
            this.setEmailAddress('fromAddress', fromAddress);
        },

        setSupportAddress(supportAddress) {
            this.setEmailAddress('supportAddress', supportAddress);
        },

        toggleEmailTrackOpens(event) {
            if (event) {
                event.preventDefault();
            }
            this.set('settings.emailTrackOpens', !this.get('emailTrackOpens'));
        },

        toggleSelfSignup() {
            this.set('settings.membersAllowFreeSignup', !this.get('allowSelfSignup'));
        },

        setStripeDirectPublicKey(event) {
            this.set('settings.stripeProductName', this.get('settings.title'));
            this.set('settings.stripePublishableKey', event.target.value);
        },

        setStripeDirectSecretKey(event) {
            this.set('settings.stripeProductName', this.get('settings.title'));
            this.set('settings.stripeSecretKey', event.target.value);
        },

        validateStripePlans() {
            this.get('settings.errors').remove('stripePlans');
            this.get('settings.hasValidated').removeObject('stripePlans');

            if (this._scratchStripeYearlyAmount === null) {
                this._scratchStripeYearlyAmount = this.get('stripePlans').yearly.amount;
            }
            if (this._scratchStripeMonthlyAmount === null) {
                this._scratchStripeMonthlyAmount = this.get('stripePlans').monthly.amount;
            }

            try {
                const selectedCurrency = this.selectedCurrency;
                const yearlyAmount = parseInt(this._scratchStripeYearlyAmount);
                const monthlyAmount = parseInt(this._scratchStripeMonthlyAmount);
                if (!yearlyAmount || yearlyAmount < 1 || !monthlyAmount || monthlyAmount < 1) {
                    throw new TypeError(`Subscription amount must be at least ${selectedCurrency.symbol}1.00`);
                }

                const updatedPlans = this.get('settings.stripePlans').map((plan) => {
                    if (plan.name !== 'Complim entary') {
                        let newAmount;
                        if (plan.interval === 'year') {
                            newAmount = yearlyAmount * 100;
                        } else if (plan.interval === 'month') {
                            newAmount = monthlyAmount * 100;
                        }
                        return Object.assign({}, plan, {
                            amount: newAmount
                        });
                    }
                    return plan;
                });

                this.set('settings.stripePlans', updatedPlans);
            } catch (err) {
                this.get('settings.errors').add('stripePlans', err.message);
            } finally {
                this.get('settings.hasValidated').pushObject('stripePlans');
            }
        },

        setStripePlansCurrency(event) {
            const newCurrency = event.value;
            const updatedPlans = this.get('settings.stripePlans').map((plan) => {
                if (plan.name !== 'Complimentary') {
                    return Object.assign({}, plan, {
                        currency: newCurrency
                    });
                }
                return plan;
            });

            const currentComplimentaryPlan = updatedPlans.find((plan) => {
                return plan.name === 'Complimentary' && plan.currency === event.value;
            });

            if (!currentComplimentaryPlan) {
                updatedPlans.push({
                    name: 'Complimentary',
                    currency: event.value,
                    interval: 'year',
                    amount: 0
                });
            }

            this.set('settings.stripePlans', updatedPlans);
        },

        setReplyAddress(event) {
            const newReplyAddress = event.value;

            this.set('settings.membersReplyAddress', newReplyAddress);
        },

        setStripeConnectIntegrationToken(event) {
            this.set('settings.stripeProductName', this.get('settings.title'));
            this.setStripeConnectIntegrationTokenSetting(event.target.value);
        },

        openDisconnectStripeModal() {
            this.openDisconnectStripeConnectModal.perform();
        },

        closeDisconnectStripeModal() {
            this.set('showDisconnectStripeConnectModal', false);
        },

        disconnectStripeConnectIntegration() {
            this.disconnectStripeConnectIntegration.perform();
        },

        closeLeaveSettingsModal() {
            this.set('showLeaveSettingsModal', false);
        },

        leavePortalSettings() {
            this.settings.rollbackAttributes();
            this.set('showPortalSettings', false);
            this.set('showLeaveSettingsModal', false);
        },

        openStripeSettings() {
            this.set('membersStripeOpen', true);
        }
    },

    openDisconnectStripeConnectModal: task(function* () {
        this.set('hasActiveStripeSubscriptions', false);
        if (!this.get('stripeConnectAccountId')) {
            return;
        }
        const url = this.get('ghostPaths.url').api('/members/hasActiveStripeSubscriptions');
        const response = yield this.ajax.request(url);

        if (response.hasActiveStripeSubscriptions) {
            this.set('hasActiveStripeSubscriptions', true);
            return;
        }
        this.set('showDisconnectStripeConnectModal', true);
    }).drop(),

    disconnectStripeConnectIntegration: task(function* () {
        this.set('disconnectStripeError', false);
        const url = this.get('ghostPaths.url').api('/settings/stripe/connect');

        yield this.ajax.delete(url);
        yield this.settings.reload();
    }),

    saveStripeSettings: task(function* () {
        this.set('stripeConnectError', null);
        this.set('stripeConnectSuccess', null);
        if (this.get('settings.stripeConnectIntegrationToken')) {
            try {
                const response = yield this.settings.save();
                this.set('membersStripeOpen', false);
                this.set('stripeConnectSuccess', true);
                return response;
            } catch (error) {
                if (error.payload && error.payload.errors) {
                    this.set('stripeConnectError', 'Invalid secure key');
                    return false;
                }
                throw error;
            }
        } else {
            this.set('stripeConnectError', 'Please enter a secure key');
        }
    }).drop(),

    updateFromAddress: task(function* () {
        let url = this.get('ghostPaths.url').api('/settings/members/email');
        try {
            const response = yield this.ajax.post(url, {
                data: {
                    email: this.fromAddress,
                    type: 'fromAddressUpdate'
                }
            });
            this.toggleProperty('showFromAddressConfirmation');
            return response;
        } catch (e) {
            // Failed to send email, retry
            return false;
        }
    }).drop(),

    updateSupportAddress: task(function* () {
        let url = this.get('ghostPaths.url').api('/settings/members/email');
        try {
            const response = yield this.ajax.post(url, {
                data: {
                    email: this.supportAddress,
                    type: 'supportAddressUpdate'
                }
            });
            this.toggleProperty('showSupportAddressConfirmation');
            return response;
        } catch (e) {
            // Failed to send email, retry
            return false;
        }
    }).drop(),

    get liveStripeConnectAuthUrl() {
        return this.ghostPaths.url.api('members/stripe_connect') + '?mode=live';
    },

    get testStripeConnectAuthUrl() {
        return this.ghostPaths.url.api('members/stripe_connect') + '?mode=test';
    }
});
