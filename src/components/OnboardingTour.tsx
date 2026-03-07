import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

const ACCENT_COLOR = '#ff4b2b';

export type TourLanguage = 'en' | 'rw';

type Copy = {
  chooseLanguageTitle: string;
  chooseLanguageSubtitle: string;
  english: string;
  kinyarwanda: string;
  next: string;
  back: string;
  finish: string;
  tourTitle: string;
  slides: Array<{ title: string; body: string; highlight: 'like' | 'message' | 'pass' }>;
};

const copyByLanguage: Record<TourLanguage, Copy> = {
  en: {
    chooseLanguageTitle: 'Choose language',
    chooseLanguageSubtitle: 'You can change this later in Settings.',
    english: 'English',
    kinyarwanda: 'Kinyarwanda',
    next: 'Next',
    back: 'Back',
    finish: 'Finish',
    tourTitle: 'Quick Tour',
    slides: [
      {
        title: 'Like',
        body: 'Tap Like when you’re interested. If they like you back, you match.',
        highlight: 'like',
      },
      {
        title: 'Pre-message',
        body: 'Send a short message before matching to stand out and start a conversation.',
        highlight: 'message',
      },
      {
        title: 'Pass',
        body: 'Tap X to skip. You’ll see a new profile right away.',
        highlight: 'pass',
      },
    ],
  },
  rw: {
    chooseLanguageTitle: 'Hitamo ururimi',
    chooseLanguageSubtitle: 'Ushobora kuruhindura nyuma muri Settings.',
    english: 'Icyongereza',
    kinyarwanda: 'Ikinyarwanda',
    next: 'Komeza',
    back: 'Inyuma',
    finish: 'Rangiza',
    tourTitle: 'Uko wakoresha Umutima',
    slides: [
      {
        title: 'Like',
        body: 'Kanda Like (ku mutima) Niba uwo muntu umukunze. Naramuka agukunze na we, akora like back muhita mukora match.',
        highlight: 'like',
      },
      {
        title: 'Ubutumwa bwa mbere',
        body: 'Ohereza ubutumwa bugufi mbere ya match kugira ngo mu menyane vuba kandi mutangire ikiganiro.',
        highlight: 'message',
      },
      {
        title: 'X (Gusimbuka)',
        body: 'Kanda X niba utamushaka. Uhita werekwa undi muntu.',
        highlight: 'pass',
      },
    ],
  },
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type OnboardingTourProps = {
  visible: boolean;
  selectedLanguage: TourLanguage | null;
  onClose: () => void;
  onSelectLanguage: (language: TourLanguage) => void;
  onComplete: () => void;
};

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  visible,
  selectedLanguage,
  onClose,
  onSelectLanguage,
  onComplete,
}) => {
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);

  const languageForCopy: TourLanguage = selectedLanguage ?? 'en';
  const copy = useMemo(() => copyByLanguage[languageForCopy], [languageForCopy]);

  const slides = copy.slides;
  const total = slides.length;

  const goTo = (nextIndex: number) => {
    const clamped = Math.max(0, Math.min(total - 1, nextIndex));
    setIndex(clamped);
    scrollRef.current?.scrollTo({ x: clamped * SCREEN_WIDTH, animated: true });
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const newIndex = Math.round(x / SCREEN_WIDTH);
    if (!Number.isNaN(newIndex)) setIndex(newIndex);
  };

  const handleFinish = () => {
    onComplete();
  };

  const ActionIcon = ({ kind }: { kind: 'like' | 'message' | 'pass' }) => {
    if (kind === 'like') {
      return (
        <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12.001 5.5c-1.54-1.67-4.04-1.67-5.58 0-1.5 1.63-1.5 4.27 0 5.9l4.47 4.85a1 1 0 0 0 1.46 0l4.47-4.85c1.5-1.63 1.5-4.27 0-5.9-1.54-1.67-4.04-1.67-5.58 0Z"
            fill="#FFFFFF"
          />
        </Svg>
      );
    }

    if (kind === 'message') {
      return (
        <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
          <Path
            d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
            stroke="#FFFFFF"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    }

    return (
      <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
        <Path d="M6 6l12 12M18 6L6 18" stroke="#111827" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  };

  const ActionPreview = ({ kind }: { kind: 'like' | 'message' | 'pass' }) => {
    const buttonStyle =
      kind === 'like'
        ? styles.actionPreviewLike
        : kind === 'message'
          ? styles.actionPreviewMessage
          : styles.actionPreviewPass;

    return (
      <View style={styles.actionPreviewWrap}>
        <View style={[styles.actionPreviewSingle, buttonStyle]}>
          <ActionIcon kind={kind} />
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <SafeAreaView style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{copy.tourTitle}</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={styles.headerClose}>
                <Text style={styles.headerCloseText}>×</Text>
              </TouchableOpacity>
            </View>
          </View>

          {!selectedLanguage ? (
            <View style={styles.languageWrap}>
              <Text style={styles.languageTitle}>{copy.chooseLanguageTitle}</Text>
              <Text style={styles.languageSubtitle}>{copy.chooseLanguageSubtitle}</Text>

              <View style={styles.languageButtons}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.languageButtonSecondary}
                  onPress={() => {
                    onSelectLanguage('en');
                    setIndex(0);
                  }}
                >
                  <Text style={styles.languageButtonSecondaryText}>{copyByLanguage.en.english}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.languageButtonPrimary}
                  onPress={() => {
                    onSelectLanguage('rw');
                    setIndex(0);
                  }}
                >
                  <Text style={styles.languageButtonPrimaryText}>{copyByLanguage.rw.kinyarwanda}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <ScrollView
                ref={(r) => {
                  scrollRef.current = r;
                }}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleScrollEnd}
                scrollEventThrottle={16}
                style={styles.slider}
              >
                {slides.map((s, i) => (
                  <View key={`${s.title}_${i}`} style={styles.slide}>
                    <View style={styles.slideInner}>
                      <ActionPreview kind={s.highlight} />
                      <Text style={styles.slideTitle}>{s.title}</Text>
                      <Text style={styles.slideBody}>{s.body}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.dotsRow}>
                {slides.map((_, i) => (
                  <View
                    key={`dot_${i}`}
                    style={[styles.dot, i === index ? styles.dotActive : undefined]}
                  />
                ))}
              </View>

              <View style={styles.footer}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => goTo(index - 1)}
                  disabled={index === 0}
                  style={[styles.footerButtonSecondary, index === 0 ? styles.disabled : undefined]}
                >
                  <Text style={styles.footerButtonSecondaryText}>{copy.back}</Text>
                </TouchableOpacity>

                {index === total - 1 ? (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={handleFinish}
                    style={styles.footerButtonPrimary}
                  >
                    <Text style={styles.footerButtonPrimaryText}>{copy.finish}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => goTo(index + 1)}
                    style={styles.footerButtonPrimary}
                  >
                    <Text style={styles.footerButtonPrimaryText}>{copy.next}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    padding: 16,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(17, 24, 39, 0.10)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.06)',
  },
  headerCloseText: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '700',
    marginTop: -2,
  },
  languageWrap: {
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 18,
  },
  languageTitle: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  languageSubtitle: {
    color: '#4B5563',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  languageButtons: {
    gap: 10,
  },
  languageButtonPrimary: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT_COLOR,
  },
  languageButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  languageButtonSecondary: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  languageButtonSecondaryText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
  },
  slider: {
    marginTop: 12,
  },
  slide: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 16,
    paddingTop: 26,
    paddingBottom: 12,
  },
  slideInner: {
    minHeight: 220,
    borderRadius: 18,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 18,
    justifyContent: 'center',
  },
  actionPreviewWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  actionPreviewSingle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actionPreviewLike: {
    backgroundColor: ACCENT_COLOR,
    borderColor: 'rgba(255, 75, 43, 0.35)',
  },
  actionPreviewMessage: {
    backgroundColor: '#111827',
    borderColor: 'rgba(17, 24, 39, 0.12)',
  },
  actionPreviewPass: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  slideTitle: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 8,
  },
  slideBody: {
    color: '#4B5563',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(17, 24, 39, 0.22)',
  },
  dotActive: {
    width: 18,
    backgroundColor: ACCENT_COLOR,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
  },
  footerButtonSecondary: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  footerButtonSecondaryText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
  },
  footerButtonPrimary: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT_COLOR,
  },
  footerButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.45,
  },
});
