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

const ACCENT_COLOR = '#ff4b2b';

export type TourLanguage = 'en' | 'rw';

type Copy = {
  chooseLanguageTitle: string;
  chooseLanguageSubtitle: string;
  english: string;
  kinyarwanda: string;
  skip: string;
  next: string;
  back: string;
  finish: string;
  tourTitle: string;
  slides: Array<{ title: string; body: string }>;
};

const copyByLanguage: Record<TourLanguage, Copy> = {
  en: {
    chooseLanguageTitle: 'Choose language',
    chooseLanguageSubtitle: 'You can change this later in Settings.',
    english: 'English',
    kinyarwanda: 'Kinyarwanda',
    skip: 'Skip',
    next: 'Next',
    back: 'Back',
    finish: 'Finish',
    tourTitle: 'Quick Tour',
    slides: [
      {
        title: 'Welcome to Umutima',
        body: 'We’ll show you the basics so you can start matching confidently.',
      },
      {
        title: 'Explore',
        body: 'Browse people and open profiles. Like someone to show interest.',
      },
      {
        title: 'Likes',
        body: 'See who liked you and respond to connect faster.',
      },
      {
        title: 'Matches & Chat',
        body: 'When you both like each other, it’s a match. Start chatting instantly.',
      },
      {
        title: 'Your Profile',
        body: 'Add great photos and a short bio. A complete profile gets more matches.',
      },
    ],
  },
  rw: {
    chooseLanguageTitle: 'Hitamo ururimi',
    chooseLanguageSubtitle: 'Ushobora kuruhindura nyuma muri Settings.',
    english: 'Icyongereza',
    kinyarwanda: 'Ikinyarwanda',
    skip: 'Simbuka',
    next: 'Komeza',
    back: 'Subira',
    finish: 'Rangiza',
    tourTitle: 'Uko wakoresha',
    slides: [
      {
        title: 'Murakaza neza kuri Umutima',
        body: 'Tugiye kukwereka ib’ingenzi kugira ngo utangire gushaka uwo mukundana neza.',
      },
      {
        title: 'Gushakisha',
        body: 'Reba abantu, ufungure profiles. Kanda Like ku uwo ukunze.',
      },
      {
        title: 'Abagukunze',
        body: 'Reba abagukunze kandi usubize vuba kugira ngo muhure.',
      },
      {
        title: 'Matches & Ubutumwa',
        body: 'Iyo mwese mukundanye bibaho Match. Hita utangira kuganira.',
      },
      {
        title: 'Profile yawe',
        body: 'Shyiramo amafoto meza na bio ngufi. Profile yuzuye ikururira matches nyinshi.',
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

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <SafeAreaView style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{copy.tourTitle}</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={styles.headerButton}>
                <Text style={styles.headerButtonText}>{copy.skip}</Text>
              </TouchableOpacity>
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

              <TouchableOpacity onPress={onClose} activeOpacity={0.9} style={styles.skipLink}>
                <Text style={styles.skipLinkText}>{copy.skip}</Text>
              </TouchableOpacity>
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
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    padding: 16,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#0B1220',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerButtonText: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '700',
  },
  headerClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerCloseText: {
    color: '#FFFFFF',
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
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  languageSubtitle: {
    color: '#9CA3AF',
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  languageButtonSecondaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  skipLink: {
    marginTop: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  skipLinkText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '700',
  },
  slider: {
    width: '100%',
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
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 18,
    justifyContent: 'center',
  },
  slideTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 8,
  },
  slideBody: {
    color: '#D1D5DB',
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
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  footerButtonSecondaryText: {
    color: '#FFFFFF',
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
