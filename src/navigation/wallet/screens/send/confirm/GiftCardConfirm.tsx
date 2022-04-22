import React, {useEffect, useMemo, useState} from 'react';
import {useNavigation, useRoute, CommonActions} from '@react-navigation/native';
import {Hr} from '../../../../../components/styled/Containers';
import {RouteProp} from '@react-navigation/core';
import {WalletStackParamList} from '../../../WalletStack';
import {useAppDispatch, useAppSelector} from '../../../../../utils/hooks';
import {H4, TextAlign} from '../../../../../components/styled/Text';
import {
  Recipient,
  TransactionProposal,
  TxDetails,
  Wallet,
} from '../../../../../store/wallet/wallet.models';
import SwipeButton from '../../../../../components/swipe-button/SwipeButton';
import {
  createPayProTxProposal,
  handleCreateTxProposalError,
  removeTxp,
  showNoWalletsModal,
  startSendPayment,
} from '../../../../../store/wallet/effects/send/send';
import {sleep, formatFiatAmount} from '../../../../../utils/helper-methods';
import {startOnGoingProcessModal} from '../../../../../store/app/app.effects';
import {OnGoingProcessMessages} from '../../../../../components/modal/ongoing-process/OngoingProcess';
import {dismissOnGoingProcessModal} from '../../../../../store/app/app.actions';
import RemoteImage from '../../../../tabs/shop/components/RemoteImage';
import SheetModal from '../../../../../components/modal/base/sheet/SheetModal';
import {
  WalletSelectMenuBodyContainer,
  WalletSelectMenuContainer,
  WalletSelectMenuHeaderContainer,
} from '../../GlobalSelect';
import KeyWalletsRow, {
  KeyWalletsRowProps,
} from '../../../../../components/list/KeyWalletsRow';
import {ShopActions, ShopEffects} from '../../../../../store/shop';
import {BuildKeysAndWalletsList} from '../../../../../store/wallet/utils/wallet';
import {
  Amount,
  ConfirmContainer,
  DetailContainer,
  DetailRow,
  DetailsList,
  Header,
  SendingFrom,
} from './Shared';
import {AppActions} from '../../../../../store/app';
import {CustomErrorMessage} from '../../../components/ErrorMessages';
import {APP_NETWORK, BASE_BITPAY_URLS} from '../../../../../constants/config';
import {Terms} from '../../../../tabs/shop/components/styled/ShopTabComponents';
import {
  CardConfig,
  GiftCardDiscount,
} from '../../../../../store/shop/shop.models';

export interface GiftCardConfirmParamList {
  amount: number;
  cardConfig: CardConfig;
  discounts: GiftCardDiscount[];
  wallet?: Wallet;
  recipient?: Recipient;
  txp?: TransactionProposal;
  txDetails?: TxDetails;
}

const GiftCardHeader = ({
  amount,
  cardConfig,
}: {
  amount: number;
  cardConfig: CardConfig;
}): JSX.Element | null => {
  return (
    <>
      <Header hr>
        <>{cardConfig.displayName} Gift Card</>
      </Header>
      <DetailContainer height={73}>
        <DetailRow>
          <H4>
            {formatFiatAmount(amount, cardConfig.currency)}{' '}
            {cardConfig.currency}
          </H4>
          <RemoteImage uri={cardConfig.icon} height={40} borderRadius={40} />
        </DetailRow>
      </DetailContainer>
      <Hr style={{marginBottom: 40}} />
    </>
  );
};

const Confirm = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<WalletStackParamList, 'GiftCardConfirm'>>();
  const {
    amount,
    cardConfig,
    discounts,
    wallet: _wallet,
    recipient: _recipient,
    txDetails: _txDetails,
    txp: _txp,
  } = route.params!;
  const keys = useAppSelector(({WALLET}) => WALLET.keys);
  const giftCards = useAppSelector(({SHOP}) => SHOP.giftCards[APP_NETWORK]);

  const [walletSelectModalVisible, setWalletSelectModalVisible] =
    useState(false);
  const [key, setKey] = useState(keys[_wallet ? _wallet.keyId : '']);
  const [wallet, setWallet] = useState(_wallet);
  const [recipient, setRecipient] = useState(_recipient);
  const [txDetails, updateTxDetails] = useState(_txDetails);
  const [txp, updateTxp] = useState(_txp);
  const [keyWallets, setKeysWallets] = useState<KeyWalletsRowProps[]>();
  const {fee, networkCost, sendingFrom, total} = txDetails || {};

  const unsoldGiftCard = giftCards.find(
    giftCard => giftCard.invoiceId === txp?.invoiceID,
  );

  const memoizedKeysAndWalletsList = useMemo(
    () => BuildKeysAndWalletsList({keys, network: APP_NETWORK}),
    [keys],
  );

  const reshowWalletSelector = async () => {
    await sleep(400);
    setWalletSelectModalVisible(true);
  };

  useEffect(() => {
    return () => {
      dispatch(ShopActions.deletedUnsoldGiftCards());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openKeyWalletSelector = () => {
    if (memoizedKeysAndWalletsList.length) {
      setKeysWallets(memoizedKeysAndWalletsList);
      setWalletSelectModalVisible(true);
    } else {
      dispatch(showNoWalletsModal({navigation}));
    }
  };

  const onWalletSelect = async (selectedWallet: Wallet) => {
    setWalletSelectModalVisible(false);
    // not ideal - will dive into why the timeout has to be this long
    await sleep(400);
    dispatch(
      startOnGoingProcessModal(OnGoingProcessMessages.FETCHING_PAYMENT_INFO),
    );
    if (txp) {
      dispatch(ShopActions.deletedUnsoldGiftCards());
    }
    try {
      const {name: brand, currency} = cardConfig;
      const {invoice, invoiceId} = await dispatch(
        ShopEffects.startCreateGiftCardInvoice(cardConfig!, {
          amount,
          brand,
          currency,
          clientId: selectedWallet.id,
          discounts: discounts.map(d => d.code) || [],
          transactionCurrency:
            selectedWallet.currencyAbbreviation.toUpperCase(),
        }),
      );
      const baseUrl = BASE_BITPAY_URLS[APP_NETWORK];
      const paymentUrl = `${baseUrl}/i/${invoiceId}`;
      const {txDetails: newTxDetails, txp: newTxp} = await dispatch(
        await createPayProTxProposal({
          wallet: selectedWallet,
          paymentUrl,
          invoice,
          invoiceID: invoiceId,
          message: `${formatFiatAmount(amount, currency)} Gift Card`,
          customData: {
            giftCardName: brand,
            service: 'giftcards',
          },
        }),
      );
      setWallet(selectedWallet);
      setKey(keys[selectedWallet.keyId]);
      await sleep(400);
      dispatch(dismissOnGoingProcessModal());
      updateTxDetails(newTxDetails);
      updateTxp(newTxp);
      setRecipient({address: newTxDetails.sendingTo.recipientAddress} as {
        address: string;
      });
    } catch (err: any) {
      await sleep(400);
      dispatch(dismissOnGoingProcessModal());
      const [errorConfig] = await Promise.all([
        handleCreateTxProposalError(err),
        sleep(500),
      ]);
      dispatch(
        AppActions.showBottomNotificationModal(
          CustomErrorMessage({
            title: 'Error',
            errMsg:
              err.response?.data?.message || err.message || errorConfig.message,
            action: () => reshowWalletSelector(),
          }),
        ),
      );
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => openKeyWalletSelector(), []);

  return (
    <ConfirmContainer>
      <DetailsList>
        <GiftCardHeader amount={amount} cardConfig={cardConfig} />
        {txp && recipient && wallet ? (
          <>
            <Header hr>Summary</Header>
            <SendingFrom
              sender={sendingFrom!}
              onPress={openKeyWalletSelector}
              hr
            />
            {unsoldGiftCard && unsoldGiftCard.totalDiscount ? (
              <Amount
                description={'Discount'}
                amount={{
                  fiatAmount: `— ${formatFiatAmount(
                    unsoldGiftCard.totalDiscount,
                    cardConfig.currency,
                  )}`,
                  cryptoAmount: '',
                }}
                fiatOnly
                hr
              />
            ) : null}
            <Amount
              description={'Network Cost'}
              amount={networkCost}
              fiatOnly
              hr
            />
            <Amount description={'Miner fee'} amount={fee} fiatOnly hr />
            <Amount description={'Total'} amount={total} />
            <Terms>{cardConfig.terms}</Terms>
          </>
        ) : null}
      </DetailsList>
      {txp && recipient && wallet ? (
        <>
          <SwipeButton
            title={'Slide to send'}
            onSwipeComplete={async () => {
              try {
                dispatch(
                  startOnGoingProcessModal(
                    OnGoingProcessMessages.SENDING_PAYMENT,
                  ),
                );
                await sleep(400);
                dispatch(
                  ShopActions.updatedGiftCardStatus({
                    invoiceId: txp.invoiceID!,
                    status: 'PENDING',
                  }),
                );
                await dispatch(startSendPayment({txp, key, wallet, recipient}));
                if (txp.invoiceID) {
                  dispatch(
                    startOnGoingProcessModal(
                      OnGoingProcessMessages.GENERATING_GIFT_CARD,
                    ),
                  );
                  const giftCard = await dispatch(
                    ShopEffects.startRedeemGiftCard(txp.invoiceID),
                  );
                  await sleep(200);
                  dispatch(dismissOnGoingProcessModal());
                  await sleep(400);
                  if (giftCard.status === 'PENDING') {
                    dispatch(
                      ShopEffects.waitForConfirmation(giftCard.invoiceId),
                    );
                  }
                  navigation.dispatch(
                    CommonActions.reset({
                      index: 2,
                      routes: [
                        {
                          name: 'Tabs',
                          params: {screen: 'Shop'},
                        },
                        {
                          name: 'GiftCard',
                          params: {
                            screen: 'GiftCardDetails',
                            params: {
                              giftCard,
                              cardConfig,
                            },
                          },
                        },
                      ],
                    }),
                  );
                  return;
                }
                dispatch(dismissOnGoingProcessModal());
              } catch (err: any) {
                dispatch(
                  ShopActions.updatedGiftCardStatus({
                    invoiceId: txp.invoiceID!,
                    status: 'UNREDEEMED',
                  }),
                );
                await removeTxp(wallet, txp).catch(removeErr =>
                  console.error('error deleting txp', removeErr),
                );
                dispatch(dismissOnGoingProcessModal());
                await sleep(400);
                updateTxDetails(undefined);
                updateTxp(undefined);
                setWallet(undefined);
                dispatch(
                  AppActions.showBottomNotificationModal(
                    CustomErrorMessage({
                      title: 'Error',
                      errMsg: err.message || 'Could not send transaction',
                      action: () => reshowWalletSelector(),
                    }),
                  ),
                );
              }
            }}
          />
        </>
      ) : null}

      <SheetModal
        isVisible={walletSelectModalVisible}
        onBackdropPress={async () => {
          setWalletSelectModalVisible(false);
          if (!txp) {
            await sleep(100);
            navigation.goBack();
          }
        }}>
        <WalletSelectMenuContainer>
          <WalletSelectMenuHeaderContainer>
            <TextAlign align={'center'}>
              <H4>Select a wallet</H4>
            </TextAlign>
          </WalletSelectMenuHeaderContainer>
          <WalletSelectMenuBodyContainer>
            <KeyWalletsRow keyWallets={keyWallets!} onPress={onWalletSelect} />
          </WalletSelectMenuBodyContainer>
        </WalletSelectMenuContainer>
      </SheetModal>
    </ConfirmContainer>
  );
};

export default Confirm;
