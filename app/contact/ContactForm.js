"use client";

import { useMemo, useState } from "react";
import styles from "./contact.module.css";

/*
 * 必ず実際に受信できるメールアドレスへ変更してください。
 * 例: contact@boat-strike.online
 */
const CONTACT_EMAIL = "marron.toyohashi@gmail.com";

const initialForm = {
  name: "",
  email: "",
  category: "",
  subject: "",
  message: "",
  agreement: false,
};

export default function ContactForm() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("");

  const isEmailConfigured = useMemo(
    () => !CONTACT_EMAIL.includes("YOUR_EMAIL"),
    []
  );

  const updateField = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));

    setErrors((current) => ({
      ...current,
      [name]: "",
    }));
    setStatus("");
  };

  const validate = () => {
    const nextErrors = {};

    if (!form.name.trim()) {
      nextErrors.name = "お名前を入力してください。";
    }

    if (!form.email.trim()) {
      nextErrors.email = "メールアドレスを入力してください。";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = "正しいメールアドレスを入力してください。";
    }

    if (!form.category) {
      nextErrors.category = "お問い合わせ種別を選択してください。";
    }

    if (!form.subject.trim()) {
      nextErrors.subject = "件名を入力してください。";
    }

    if (!form.message.trim()) {
      nextErrors.message = "お問い合わせ内容を入力してください。";
    } else if (form.message.trim().length < 10) {
      nextErrors.message = "お問い合わせ内容を10文字以上で入力してください。";
    }

    if (!form.agreement) {
      nextErrors.agreement =
        "プライバシーポリシーへの同意が必要です。";
    }

    return nextErrors;
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setStatus("入力内容をご確認ください。");
      return;
    }

    if (!isEmailConfigured) {
      setStatus(
        "送信先メールアドレスが未設定です。ContactForm.jsのCONTACT_EMAILを変更してください。"
      );
      return;
    }

    const body = [
      "BoatStrikers お問い合わせ",
      "",
      `お名前: ${form.name.trim()}`,
      `メールアドレス: ${form.email.trim()}`,
      `お問い合わせ種別: ${form.category}`,
      `件名: ${form.subject.trim()}`,
      "",
      "お問い合わせ内容:",
      form.message.trim(),
    ].join("\n");

    const mailtoUrl =
      `mailto:${encodeURIComponent(CONTACT_EMAIL)}` +
      `?subject=${encodeURIComponent(`[BoatStrikers] ${form.subject.trim()}`)}` +
      `&body=${encodeURIComponent(body)}`;

    window.location.href = mailtoUrl;
    setStatus(
      "メールアプリを開きます。内容をご確認のうえ、メールアプリから送信してください。"
    );
  };

  return (
    <form className={styles.contactForm} onSubmit={handleSubmit} noValidate>
      <div className={styles.formGrid}>
        <div className={styles.fieldGroup}>
          <label htmlFor="contact-name">
            お名前
            <span>必須</span>
          </label>
          <input
            id="contact-name"
            name="name"
            type="text"
            value={form.name}
            onChange={updateField}
            autoComplete="name"
            placeholder="例：山田 太郎"
            aria-describedby={errors.name ? "contact-name-error" : undefined}
          />
          {errors.name && (
            <p id="contact-name-error" className={styles.errorText}>
              {errors.name}
            </p>
          )}
        </div>

        <div className={styles.fieldGroup}>
          <label htmlFor="contact-email">
            メールアドレス
            <span>必須</span>
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            value={form.email}
            onChange={updateField}
            autoComplete="email"
            placeholder="例：sample@example.com"
            aria-describedby={errors.email ? "contact-email-error" : undefined}
          />
          {errors.email && (
            <p id="contact-email-error" className={styles.errorText}>
              {errors.email}
            </p>
          )}
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <label htmlFor="contact-category">
          お問い合わせ種別
          <span>必須</span>
        </label>
        <select
          id="contact-category"
          name="category"
          value={form.category}
          onChange={updateField}
          aria-describedby={
            errors.category ? "contact-category-error" : undefined
          }
        >
          <option value="">選択してください</option>
          <option value="ご質問・ご意見">ご質問・ご意見</option>
          <option value="掲載内容の修正・削除">掲載内容の修正・削除</option>
          <option value="動画・レース映像・権利関係">
            動画・レース映像・権利関係
          </option>
          <option value="広告・タイアップ・お仕事">
            広告・タイアップ・お仕事
          </option>
          <option value="不具合の報告">不具合の報告</option>
          <option value="その他">その他</option>
        </select>
        {errors.category && (
          <p id="contact-category-error" className={styles.errorText}>
            {errors.category}
          </p>
        )}
      </div>

      <div className={styles.fieldGroup}>
        <label htmlFor="contact-subject">
          件名
          <span>必須</span>
        </label>
        <input
          id="contact-subject"
          name="subject"
          type="text"
          value={form.subject}
          onChange={updateField}
          placeholder="例：掲載内容について"
          aria-describedby={
            errors.subject ? "contact-subject-error" : undefined
          }
        />
        {errors.subject && (
          <p id="contact-subject-error" className={styles.errorText}>
            {errors.subject}
          </p>
        )}
      </div>

      <div className={styles.fieldGroup}>
        <label htmlFor="contact-message">
          お問い合わせ内容
          <span>必須</span>
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows="9"
          value={form.message}
          onChange={updateField}
          placeholder={
            "お問い合わせ内容をご記入ください。\n対象ページや動画がある場合は、URLもご記入ください。"
          }
          aria-describedby={
            errors.message ? "contact-message-error" : undefined
          }
        />
        <div className={styles.characterCount}>
          {form.message.length.toLocaleString()}文字
        </div>
        {errors.message && (
          <p id="contact-message-error" className={styles.errorText}>
            {errors.message}
          </p>
        )}
      </div>

      <div className={styles.agreementGroup}>
        <label>
          <input
            name="agreement"
            type="checkbox"
            checked={form.agreement}
            onChange={updateField}
          />
          <span>
            <a href="/privacy" target="_blank" rel="noopener noreferrer">
              プライバシーポリシー
            </a>
            を確認し、個人情報の取り扱いに同意します。
          </span>
        </label>

        {errors.agreement && (
          <p className={styles.errorText}>{errors.agreement}</p>
        )}
      </div>

     

      {status && (
        <p className={styles.formStatus} role="status">
          {status}
        </p>
      )}

      <button type="submit" className={styles.submitButton}>
        入力内容をメールで送る
      </button>

      <p className={styles.submitNote}>
        送信ボタンを押すと、お使いのメールアプリが開きます。
        メールアプリ上で内容を確認して送信してください。
      </p>
    </form>
  );
}
