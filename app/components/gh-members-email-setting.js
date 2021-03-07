import Component from '@ember/component';
import {computed} from '@ember/object';
import {reads} from '@ember/object/computed';
import {inject as service} from '@ember/service';
import {task} from 'ember-concurrency';

const US = {flag: '🇺🇸', name: 'US', baseUrl: 'https://api.mailgun.net/v3'};
const EU = {flag: '🇪🇺', name: 'EU', baseUrl: 'https://api.eu.mailgun.net/v3'};

const MAILGUN = {label: 'Mailgun', value: 'mailgun'};
const AWS_SES = {label: 'AWS SES', value: 'ses'};
const BULK_EMAIL_PROVIDERS = [MAILGUN, AWS_SES];
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

    replyAddresses: null,
    showFromAddressConfirmation: false,
    showSupportAddressConfirmation: false,
    showEmailDesignSettings: false,
    showLeaveSettingsModal: false,

    // passed in actions
    mailgunIsConfigured: reads('config.mailgunIsConfigured'),
    emailTrackOpens: reads('settings.emailTrackOpens'),

    selectedReplyAddress: computed('settings.membersReplyAddress', function () {
        return REPLY_ADDRESSES.findBy('value', this.get('settings.membersReplyAddress'));
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
        this.set('mailgunRegions', [US, EU]);
        this.set('replyAddresses', REPLY_ADDRESSES);
    },

    actions: {
        toggleFromAddressConfirmation() {
            this.toggleProperty('showFromAddressConfirmation');
        },

        closeEmailDesignSettings() {
            this.set('showEmailDesignSettings', false);
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

        setReplyAddress(event) {
            const newReplyAddress = event.value;

            this.set('settings.membersReplyAddress', newReplyAddress);
        },

        closeLeaveSettingsModal() {
            this.set('showLeaveSettingsModal', false);
        }
    },

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
    }).drop()
});
