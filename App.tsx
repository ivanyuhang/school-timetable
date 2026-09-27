import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { PERIODS, Timetable, WEEKDAYS, panyuWeekday, slotKey } from './src/timetable';
import { syncReminders, testNotification } from './src/notifications';

const STORAGE_KEY = 'panyu-timetable-v1';
const LEAD_OPTIONS = [0, 5, 10, 15, 30, 60];
const ink = '#173447';

type Saved = { timetable: Timetable; lead: number | null };

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [timetable, setTimetable] = useState<Timetable>({});
  const [lead, setLead] = useState<number | null>(10);
  const [view, setView] = useState<'today' | 'week'>('today');
  const [weekday, setWeekday] = useState(1);
  const [today, setToday] = useState(panyuWeekday(new Date()));
  const [editing, setEditing] = useState<{ weekday: number; period: number } | null>(null);
  const [subject, setSubject] = useState('');
  const [classroom, setClassroom] = useState('');
  const [teacher, setTeacher] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (!active) return;
      if (raw) {
        const saved: Saved = JSON.parse(raw);
        setTimetable(saved.timetable || {});
        setLead(saved.lead === null ? null : LEAD_OPTIONS.includes(saved.lead) ? saved.lead : 10);
      }
    }).catch(() => Alert.alert('Storage error', 'Could not load your saved timetable.')).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  const refresh = useCallback(() => {
    setToday(panyuWeekday(new Date()));
    if (!loaded) return;
    syncReminders(timetable, lead).then(count => {
      setNotice(count < 0 ? 'Allow notifications in Settings to receive reminders.' : lead === null ? 'Reminders are off.' : `${count} class reminder${count === 1 ? '' : 's'} scheduled.`);
    }).catch(() => setNotice('Could not update reminders. Open the app and try again.'));
  }, [loaded, timetable, lead]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => listener.remove();
  }, [refresh]);

  async function persist(next: Timetable, nextLead: number | null) {
    setSaving(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ timetable: next, lead: nextLead }));
      setTimetable(next);
      setLead(nextLead);
      return true;
    } catch {
      Alert.alert('Save failed', 'Your change was not saved. Please try again.');
      return false;
    } finally { setSaving(false); }
  }

  function openEditor(day: number, period: number) {
    const entry = timetable[slotKey(day, period)];
    setSubject(entry?.subject ?? '');
    setClassroom(entry?.classroom ?? '');
    setTeacher(entry?.teacher ?? '');
    setEditing({ weekday: day, period });
  }
  async function saveEntry() {
    if (!editing || saving) return;
    if (!subject.trim()) { Alert.alert('Subject required', 'Enter a subject, or use Remove class.'); return; }
    if (!classroom.trim()) { Alert.alert('Classroom required', 'Enter the classroom for this class.'); return; }
    const next = { ...timetable, [slotKey(editing.weekday, editing.period)]: {
      subject: subject.trim(), classroom: classroom.trim(), teacher: teacher.trim(),
    } };
    if (await persist(next, lead)) setEditing(null);
  }
  async function removeEntry() {
    if (!editing || saving) return;
    const next = { ...timetable };
    delete next[slotKey(editing.weekday, editing.period)];
    if (await persist(next, lead)) setEditing(null);
  }
  async function changeLead(value: number | null) { await persist(timetable, value); }
  async function sendTest() {
    try {
      const allowed = await testNotification();
      Alert.alert(allowed ? 'Test scheduled' : 'Permission needed',
        allowed ? 'A test notification should appear in about 5 seconds.' : 'Enable notifications for Expo Go in iPhone Settings, then try again.');
    } catch { Alert.alert('Test failed', 'Could not schedule a test notification.'); }
  }
  const shownDay = view === 'today' ? today : weekday;
  const dayLabel = shownDay >= 1 && shownDay <= 5 ? WEEKDAYS[shownDay - 1] : 'Weekend';
  const classCount = shownDay >= 1 && shownDay <= 5 ? PERIODS.filter((_, index) => timetable[slotKey(shownDay, index + 1)]?.subject).length : 0;

  if (!loaded) return <SafeAreaView style={styles.center}><ActivityIndicator color={ink} /></SafeAreaView>;
  return <SafeAreaView style={styles.safe}>
    <StatusBar style="dark" />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>PANYU CAMPUS · ASIA/SHANGHAI</Text>
        <Text style={styles.title}>My timetable</Text>
        <Text style={styles.subtle}>Every class time is shown in Panyu local time.</Text>
      </View>
      <View style={styles.tabs}>
        {(['today', 'week'] as const).map(item => <Pressable key={item} onPress={() => setView(item)} style={[styles.tab, view === item && styles.activeTab]}><Text style={[styles.tabText, view === item && styles.activeTabText]}>{item === 'today' ? 'Today' : 'Week'}</Text></Pressable>)}
      </View>
      {view === 'week' && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
        {WEEKDAYS.map((day, index) => <Pressable key={day} onPress={() => setWeekday(index + 1)} style={[styles.day, weekday === index + 1 && styles.activeDay]}><Text style={[styles.dayText, weekday === index + 1 && styles.activeDayText]}>{day.slice(0, 3)} · {PERIODS.filter((_, period) => timetable[slotKey(index + 1, period + 1)]?.subject).length}</Text></Pressable>)}
      </ScrollView>}
      <View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>{view === 'today' ? `Today · ${dayLabel}` : dayLabel}</Text><Text style={styles.subtle}>{classCount} {classCount === 1 ? 'class' : 'classes'} scheduled</Text></View></View>
      {shownDay === 0 || shownDay === 6 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No classes today</Text><Text style={styles.subtle}>Weekday classes are in the Week tab.</Text></View> : PERIODS.map(([start, end], index) => {
        const period = index + 1; const entry = timetable[slotKey(shownDay, period)];
        return <Pressable key={period} onPress={() => openEditor(shownDay, period)} style={[styles.card, entry && styles.filledCard]} accessibilityLabel={`Period ${period}, ${start} to ${end}, ${entry?.subject || 'empty'}`}>
          <View style={styles.period}><Text style={styles.periodNum}>{String(period).padStart(2, '0')}</Text><Text style={styles.periodTime}>{start}{'\n'}{end}</Text></View>
          <View style={styles.cardBody}><Text style={[styles.subject, !entry && styles.placeholder]}>{entry?.subject || 'Add a class'}</Text>{entry && <Text style={styles.detail}>{[entry.classroom, entry.teacher].filter(Boolean).join(' · ') || 'Tap to edit details'}</Text>}</View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>;
      })}
      <View style={styles.settings}><Text style={styles.sectionTitle}>Reminders</Text><Text style={styles.subtle}>Before each class · Panyu time</Text>
        <View style={styles.settingRow}><Text style={styles.settingLabel}>Reminders on</Text><Switch value={lead !== null} onValueChange={value => changeLead(value ? 10 : null)} trackColor={{ true: '#167e79' }} disabled={saving} /></View>
        {lead !== null && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.options}>{LEAD_OPTIONS.map(value => <Pressable key={value} onPress={() => changeLead(value)} style={[styles.option, lead === value && styles.activeOption]}><Text style={[styles.optionText, lead === value && styles.activeOptionText]}>{value === 0 ? 'At start' : `${value} min`}</Text></Pressable>)}</ScrollView>}
        <Text style={styles.notice}>{notice}</Text>
        <Pressable style={styles.testButton} onPress={sendTest}><Text style={styles.testText}>Send a test notification</Text></Pressable>
      </View>
    </ScrollView>
    <Modal visible={editing !== null} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}><View><Text style={styles.sectionTitle}>{editing ? `${WEEKDAYS[editing.weekday - 1]} · Period ${editing.period}` : ''}</Text><Text style={styles.subtle}>{editing ? PERIODS[editing.period - 1].join('–') : ''} · Panyu time</Text></View><Pressable onPress={() => setEditing(null)}><Text style={styles.close}>Done</Text></Pressable></View>
          <Text style={styles.inputLabel}>Subject *</Text><TextInput value={subject} onChangeText={setSubject} placeholder="e.g. Mathematics" style={styles.input} autoFocus />
          <Text style={styles.inputLabel}>Classroom *</Text><TextInput value={classroom} onChangeText={setClassroom} placeholder="e.g. Room 203" style={styles.input} />
          <Text style={styles.inputLabel}>Teacher (optional)</Text><TextInput value={teacher} onChangeText={setTeacher} placeholder="e.g. Ms Chen" style={styles.input} />
          <Pressable onPress={saveEntry} disabled={saving} style={styles.saveButton}><Text style={styles.saveText}>Save class</Text></Pressable>
          {editing && timetable[slotKey(editing.weekday, editing.period)] && <Pressable onPress={removeEntry} disabled={saving} style={styles.removeButton}><Text style={styles.removeText}>Remove class</Text></Pressable>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f8f8' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, content: { padding: 20, paddingBottom: 40 },
  header: { paddingTop: 24, paddingBottom: 24 }, eyebrow: { color: '#167e79', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 }, title: { color: ink, fontSize: 34, fontWeight: '800', marginTop: 7 }, subtle: { color: '#70838b', fontSize: 13, marginTop: 4 },
  tabs: { backgroundColor: '#e8eeee', borderRadius: 14, padding: 4, flexDirection: 'row', marginBottom: 19 }, tab: { flex: 1, padding: 11, borderRadius: 11, alignItems: 'center' }, activeTab: { backgroundColor: '#fff' }, tabText: { color: '#697d85', fontWeight: '700' }, activeTabText: { color: ink },
  days: { gap: 8, paddingBottom: 16 }, day: { paddingHorizontal: 17, paddingVertical: 10, borderRadius: 12, backgroundColor: '#e8eeee' }, activeDay: { backgroundColor: ink }, dayText: { color: '#597079', fontWeight: '700' }, activeDayText: { color: '#fff' }, sectionHead: { marginBottom: 14 }, sectionTitle: { color: ink, fontSize: 20, fontWeight: '800' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 15, marginBottom: 9, borderWidth: 1, borderColor: '#e7eeee' }, filledCard: { borderColor: '#b8dbd8', backgroundColor: '#f5fcfb' }, period: { width: 78, borderRightWidth: 1, borderRightColor: '#e0e9e9' }, periodNum: { color: '#167e79', fontSize: 20, fontWeight: '800' }, periodTime: { color: '#718890', fontSize: 11, lineHeight: 16, marginTop: 2 }, cardBody: { flex: 1, paddingLeft: 15 }, subject: { color: ink, fontWeight: '700', fontSize: 16 }, placeholder: { color: '#8fa0a4', fontWeight: '600' }, detail: { color: '#657d83', fontSize: 12, marginTop: 5 }, chevron: { color: '#9caeb1', fontSize: 26 },
  empty: { padding: 26, backgroundColor: '#fff', borderRadius: 16, marginBottom: 18 }, emptyTitle: { color: ink, fontSize: 17, fontWeight: '700' },
  settings: { marginTop: 22, padding: 19, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e7eeee' }, settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }, settingLabel: { color: ink, fontWeight: '700' }, options: { gap: 8, marginTop: 10, paddingBottom: 4 }, option: { borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: '#eef3f3' }, activeOption: { backgroundColor: '#167e79' }, optionText: { color: '#597079', fontWeight: '700' }, activeOptionText: { color: '#fff' }, notice: { color: '#70838b', fontSize: 12, marginTop: 15 }, testButton: { marginTop: 15, padding: 13, borderWidth: 1, borderColor: '#167e79', borderRadius: 11, alignItems: 'center' }, testText: { color: '#167e79', fontWeight: '800' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' }, sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 38 }, sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }, close: { color: '#167e79', fontWeight: '800' }, inputLabel: { color: ink, fontWeight: '700', marginTop: 11, marginBottom: 7 }, input: { backgroundColor: '#f3f6f6', borderRadius: 11, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: ink }, saveButton: { backgroundColor: '#167e79', borderRadius: 12, alignItems: 'center', padding: 15, marginTop: 22 }, saveText: { color: '#fff', fontWeight: '800', fontSize: 16 }, removeButton: { alignItems: 'center', padding: 14 }, removeText: { color: '#c24e4e', fontWeight: '700' },
});
