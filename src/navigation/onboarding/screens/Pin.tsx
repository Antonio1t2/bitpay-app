import {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useLayoutEffect, useRef} from 'react';
import {ScrollView} from 'react-native';
import ReactNativeBiometrics, {BiometryTypes} from 'react-native-biometrics';
import {useAndroidBackHandler} from 'react-navigation-backhandler';
import styled from 'styled-components/native';
import Button from '../../../components/button/Button';
import haptic from '../../../components/haptic-feedback/haptic';
import {
  ActionContainer,
  CtaContainer,
  HeaderRightContainer,
  ImageContainer,
  TextContainer,
  TitleContainer,
} from '../../../components/styled/Containers';
import {H3, Paragraph, TextAlign} from '../../../components/styled/Text';
import {BiometricErrorNotification} from '../../../constants/BiometricError';
import {AppActions, AppEffects} from '../../../store/app';
import {showBottomNotificationModal} from '../../../store/app/app.actions';
import {
  useAppDispatch,
  useLogger,
  useRequestTrackingPermissionHandler,
} from '../../../utils/hooks';
import {useThemeType} from '../../../utils/hooks/useThemeType';
import {OnboardingGroupParamList, OnboardingScreens} from '../OnboardingGroup';
import {OnboardingImage} from '../components/Containers';
import {useTranslation} from 'react-i18next';

const PinImage = {
  light: (
    <OnboardingImage
      style={{width: 180, height: 247}}
      source={require('../../../../assets/img/onboarding/light/pin.png')}
    />
  ),
  dark: (
    <OnboardingImage
      style={{width: 151, height: 247}}
      source={require('../../../../assets/img/onboarding/dark/pin.png')}
    />
  ),
};

const PinContainer = styled.SafeAreaView`
  flex: 1;
  align-items: stretch;
`;

const PinScreen = ({
  navigation,
}: NativeStackScreenProps<OnboardingGroupParamList, OnboardingScreens.PIN>) => {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const logger = useLogger();
  const themeType = useThemeType();

  useAndroidBackHandler(() => true);

  const askForTrackingThenNavigate = useRequestTrackingPermissionHandler();

  const onSkipPressRef = useRef(async () => {
    haptic('impactLight');
    askForTrackingThenNavigate(() => navigation.navigate('CreateKey'));
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      gestureEnabled: false,
      headerLeft: () => null,
      headerRight: () => (
        <HeaderRightContainer>
          <Button
            accessibilityLabel="skip-button"
            buttonType={'pill'}
            onPress={onSkipPressRef.current}>
            {t('Skip')}
          </Button>
        </HeaderRightContainer>
      ),
    });
  }, [navigation, t]);

  const onSetPinPress = () => {
    haptic('impactLight');
    askForTrackingThenNavigate(() => {
      dispatch(AppActions.showPinModal({type: 'set', context: 'onboarding'}));
    });
  };

  const onSetBiometricPress = async () => {
    try {
      haptic('impactLight');
      const rnBiometrics = new ReactNativeBiometrics({
        allowDeviceCredentials: true,
      });
      const {available, biometryType} = await rnBiometrics.isSensorAvailable();
      if (biometryType === BiometryTypes.FaceID) {
        await AppEffects.checkFaceIdPermissions();
      }
      if (available) {
        logger.debug(`[Biometrics] ${biometryType} is supported`);
        dispatch(AppActions.biometricLockActive(true));
        askForTrackingThenNavigate(() => navigation.navigate('CreateKey'));
      } else {
        dispatch(
          showBottomNotificationModal(
            BiometricErrorNotification(
              'Biometric method is not available on this device: ' +
                biometryType,
            ),
          ),
        );
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : JSON.stringify(err);
      logger.error(`[Biometrics] failed with error: ${errMsg}`);
      dispatch(showBottomNotificationModal(BiometricErrorNotification(errMsg)));
    }
  };

  return (
    <PinContainer accessibilityLabel="security-view">
      <ScrollView
        contentContainerStyle={{
          alignItems: 'center',
        }}>
        <ImageContainer>{PinImage[themeType]}</ImageContainer>
        <TitleContainer>
          <TextAlign align={'center'}>
            <H3>{t('Protect your wallet')}</H3>
          </TextAlign>
        </TitleContainer>
        <TextContainer>
          <TextAlign align={'center'}>
            <Paragraph>
              {t(
                'Set up an extra layer of security to keep your wallet secure.',
              )}
            </Paragraph>
          </TextAlign>
        </TextContainer>
        <CtaContainer accessibilityLabel="cta-container">
          <ActionContainer>
            <Button
              accessibilityLabel="pin-button"
              onPress={() => onSetPinPress()}
              buttonStyle={'primary'}>
              {t('PIN')}
            </Button>
          </ActionContainer>
          <ActionContainer>
            <Button
              accessibilityLabel="biometric-button"
              onPress={() => onSetBiometricPress()}
              buttonStyle={'secondary'}>
              {t('Biometric')}
            </Button>
          </ActionContainer>
        </CtaContainer>
      </ScrollView>
    </PinContainer>
  );
};

export default PinScreen;
