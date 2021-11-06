import React from 'react';
import styled from 'styled-components/native';
import Backup from '../../../assets/img/onboarding/backup.svg';
import {H3, Paragraph, TextAlign} from '../../components/styled/Text';
import {
  CtaContainer,
  ImageContainer,
  TextContainer,
  TitleContainer,
} from '../../components/styled/Containers';
import Button from '../../components/button/Button';
import {useNavigation} from '@react-navigation/native';

const BackupContainer = styled.SafeAreaView`
  flex: 1;
  align-items: center;
`;

const BackupScreen = () => {
  // const navigation = useNavigation();
  // const gotoSelectAssets = () =>
  //   navigation.navigate('Onboarding', {screen: 'SelectAssets'});

  return (
    <BackupContainer>
      <ImageContainer>
        <Backup />
      </ImageContainer>
      <TitleContainer>
        <TextAlign align={'center'}>
          <H3>Would you like to backup your wallet?</H3>
        </TextAlign>
      </TitleContainer>
      <TextContainer>
        <TextAlign align={'center'}>
          <Paragraph>
            If you delete the BitPay app or lose your device, you’ll need your recovery phrase regain acess to your funds.
          </Paragraph>
        </TextAlign>
      </TextContainer>
      <CtaContainer>
        <Button buttonStyle={'primary'}>
          Backup your Recovery Phrase
        </Button>
      </CtaContainer>
    </BackupContainer>
  );
};

export default BackupScreen;
