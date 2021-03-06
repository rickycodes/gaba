import { stub } from 'sinon';
import ComposableController from '../src/ComposableController';
import TokenRatesController, { Token } from '../src/assets/TokenRatesController';
import { AssetsController } from '../src/assets/AssetsController';
import { PreferencesController } from '../src/user/PreferencesController';
import { NetworkController } from '../src/network/NetworkController';
import { AssetsContractController } from '../src/assets/AssetsContractController';
import CurrencyRateController from '../src/assets/CurrencyRateController';

describe('TokenRatesController', () => {
	it('should set default state', () => {
		const controller = new TokenRatesController();
		expect(controller.state).toEqual({ contractExchangeRates: {} });
	});

	it('should initialize with the default config', () => {
		const controller = new TokenRatesController();
		expect(controller.config).toEqual({
			disabled: false,
			interval: 180000,
			nativeCurrency: 'eth',
			tokens: []
		});
	});

	it('should poll and update rate in the right interval', () => {
		return new Promise((resolve) => {
			const mock = stub(TokenRatesController.prototype, 'fetchExchangeRate');
			// tslint:disable-next-line: no-unused-expression
			new TokenRatesController({
				interval: 10,
				tokens: [{ address: 'bar', decimals: 0, symbol: '' }]
			});
			expect(mock.called).toBe(true);
			expect(mock.calledTwice).toBe(false);
			setTimeout(() => {
				expect(mock.calledTwice).toBe(true);
				mock.restore();
				resolve();
			}, 15);
		});
	});

	it('should not update rates if disabled', async () => {
		const controller = new TokenRatesController({
			interval: 10
		});
		controller.fetchExchangeRate = stub();
		controller.disabled = true;
		await controller.updateExchangeRates();
		expect((controller.fetchExchangeRate as any).called).toBe(false);
	});

	it('should clear previous interval', () => {
		const mock = stub(global, 'clearTimeout');
		const controller = new TokenRatesController({ interval: 1337 });
		return new Promise((resolve) => {
			setTimeout(() => {
				controller.poll(1338);
				expect(mock.called).toBe(true);
				mock.restore();
				resolve();
			}, 100);
		});
	});

	it('should update all rates', async () => {
		const assets = new AssetsController();
		const assetsContract = new AssetsContractController();
		const currencyRate = new CurrencyRateController();
		const controller = new TokenRatesController({ interval: 10 });
		const network = new NetworkController();
		const preferences = new PreferencesController();
		/* tslint:disable-next-line:no-unused-expression */
		new ComposableController([controller, assets, assetsContract, currencyRate, network, preferences]);
		const address = '0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359';
		const address2 = '0xfoO';
		expect(controller.state.contractExchangeRates).toEqual({});
		controller.tokens = [{ address, decimals: 18, symbol: 'EOS' }, { address: address2, decimals: 0, symbol: '' }];
		await controller.updateExchangeRates();
		expect(Object.keys(controller.state.contractExchangeRates)).toContain(address);
		expect(controller.state.contractExchangeRates[address]).toBeGreaterThan(0);
		expect(Object.keys(controller.state.contractExchangeRates)).toContain(address2);
		expect(controller.state.contractExchangeRates[address2]).toEqual(0);
	});

	it('should handle balance not found in API', async () => {
		const controller = new TokenRatesController({ interval: 10 });
		stub(controller, 'fetchExchangeRate').returns({ error: 'Not Found', message: 'Not Found' });
		expect(controller.state.contractExchangeRates).toEqual({});
		controller.tokens = [{ address: 'bar', decimals: 0, symbol: '' }];
		const mock = stub(controller, 'updateExchangeRates');
		await controller.updateExchangeRates();
		expect(mock).not.toThrow();
	});

	it('should subscribe to new sibling assets controllers', async () => {
		const assets = new AssetsController();
		const assetsContract = new AssetsContractController();
		const currencyRate = new CurrencyRateController();
		const controller = new TokenRatesController();
		const network = new NetworkController();
		const preferences = new PreferencesController();
		/* tslint:disable-next-line:no-unused-expression */
		new ComposableController([controller, assets, assetsContract, currencyRate, network, preferences]);
		await assets.addToken('0xfoO', 'FOO', 18);
		currencyRate.update({ nativeCurrency: 'gno' });
		const tokens = controller.context.AssetsController.state.tokens;
		const found = tokens.filter((token: Token) => token.address === '0xfoO');
		expect(found.length > 0).toBe(true);
		expect(controller.config.nativeCurrency).toEqual('gno');
	});
});
