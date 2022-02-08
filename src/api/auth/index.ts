import axios from 'axios';
import DeviceInfo from 'react-native-device-info';
import {Network} from '../../constants';
import {BASE_BITPAY_URLS} from '../../constants/config';
import {Session} from '../../store/bitpay-id/bitpay-id.models';
import {isAxiosError} from '../../utils/axios';
import {hashPassword} from '../../utils/password';
import BitPayApi from '../bitpay';
import {
  GeneratePairingCodeResponse,
  LoginErrorResponse,
  LoginResponse,
} from './auth.types';

export const AuthApi = {
  async fetchSession(network: Network): Promise<Session> {
    const {data: session} = await axios.get<Session>(
      `${BASE_BITPAY_URLS[network]}/auth/session`,
    );

    return session;
  },

  async login(
    network: Network,
    email: string,
    password: string,
    csrfToken: string,
    gCaptchaResponse?: string,
  ): Promise<LoginResponse> {
    const hashedPassword = hashPassword(password);

    const body = {
      email,
      hashedPassword,
      gCaptchaResponse,
      authSource: '',
    };

    if (!hashedPassword) {
      return {accessTypes: []};
    }

    const config = {
      headers: {
        'x-csrf-token': csrfToken,
      },
    };

    try {
      const {data} = await axios.post<LoginResponse>(
        `${BASE_BITPAY_URLS[network]}/auth/login`,
        body,
        config,
      );

      return data;
    } catch (err: any) {
      if (isAxiosError<LoginErrorResponse>(err)) {
        if (err.response?.data?.twoFactorPending) {
          return {twoFactorPending: true};
        } else if (err.response?.data?.emailAuthenticationPending) {
          return {emailAuthenticationPending: true};
        }
      }

      throw err;
    }
  },

  async submitTwoFactor(
    network: Network,
    code: string,
    csrfToken: string,
  ): Promise<LoginResponse> {
    const body = {
      twoFactorCode: code,
    };
    const config = {
      headers: {
        'x-csrf-token': csrfToken,
      },
    };

    const {data} = await axios.post<LoginResponse>(
      `${BASE_BITPAY_URLS[network]}/dashboard-api/verify-two-factor-code`,
      body,
      config,
    );

    return data;
  },

  /**
   * Requests a pairing code for an authenticated user.
   * @param network Network to determine the environment to authenticate against.
   * @param csrfToken CSRF token.
   * @returns A secret pairing code.
   */
  async generatePairingCode(
    network: Network,
    csrfToken: string,
  ): Promise<string> {
    try {
      const config = {
        headers: {
          'x-csrf-token': csrfToken,
        },
      };

      const {data} = await axios.post<GeneratePairingCodeResponse>(
        `${BASE_BITPAY_URLS[network]}/auth/generateBitAuthPairingCode`,
        null,
        config,
      );

      const pairingUrl = data?.data.url || '';
      const pairingParams = pairingUrl
        .split('?')[1]
        .split('&')
        .reduce((paramMap, kvp) => {
          const [k, v] = kvp.split('=');

          paramMap[k] = v;

          return paramMap;
        }, {} as {[k: string]: string});

      return pairingParams.secret;
    } catch (err) {
      console.log('err:', err);
      throw err;
    }
  },

  /**
   * Pairs with a BitPayID and creates an API token.
   * @param secret Encrypted token required to pair the BitPayID.
   * @param code Two-factor authentication code.
   * @returns An API token used to make session-less requests on behalf of the user.
   */
  async pair(secret: string, code?: string): Promise<string> {
    const api = BitPayApi.getInstance();
    const deviceName = DeviceInfo.getDeviceNameSync() || 'unknown device';
    const token = await api.createToken(secret, deviceName, code);

    return token;
  },
};

export default AuthApi;
