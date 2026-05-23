import type { InterviewEvaluationResponse, QAPair } from '../types';

export const generatePDF = (
  evaluation: InterviewEvaluationResponse,
  qaList: QAPair[],
  role: string
) => {
  const doc = document.createElement('div');
  doc.style.cssText = `
    width: 210mm;
    padding: 20mm;
    font-family: Arial, sans-serif;
    background: white;
    color: black;
  `;

  const html = `
    <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #05fcd3; padding-bottom: 20px;">
      <h1 style="color: #05fcd3; margin: 0; font-size: 36px;">HireMate AI</h1>
      <p style="color: #666; margin: 10px 0 0 0; font-size: 18px;">Interview Evaluation Report</p>
    </div>

    <div style="margin-bottom: 30px;">
      <h2 style="color: #05fcd3; margin-bottom: 15px; font-size: 24px;">Candidate Information</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd; background: #f9f9f9; font-weight: bold; width: 30%;">Role Applied For:</td>
          <td style="padding: 10px; border: 1px solid #ddd;">${role}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd; background: #f9f9f9; font-weight: bold;">Date:</td>
          <td style="padding: 10px; border: 1px solid #ddd;">${new Date().toLocaleDateString()}</td>
        </tr>
      </table>
    </div>

    <div style="margin-bottom: 30px;">
      <h2 style="color: #05fcd3; margin-bottom: 15px; font-size: 24px;">Performance Scores</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background: #05fcd3;">
            <th style="padding: 12px; border: 1px solid #ddd; text-align: left; color: black;">Metric</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: center; color: black;">Score</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Technical Score</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 18px; font-weight: bold; color: #05fcd3;">
              ${evaluation.technical_score?.toFixed(1) || 'N/A'} / 10
            </td>
          </tr>
          <tr style="background: #f9f9f9;">
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Communication Score</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 18px; font-weight: bold; color: #05fcd3;">
              ${evaluation.communication_score?.toFixed(1) || 'N/A'} / 10
            </td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Role Fit Score</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 18px; font-weight: bold; color: #05fcd3;">
              ${evaluation.role_fit_score?.toFixed(1) || 'N/A'} / 10
            </td>
          </tr>
          ${
            evaluation.presence_score != null
              ? `<tr style="background: #f9f9f9;">
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Presence & Body Language</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 18px; font-weight: bold; color: #05fcd3;">
              ${evaluation.presence_score?.toFixed(1) || 'N/A'} / 10
            </td>
          </tr>`
              : ''
          }
          <tr style="background: #05fcd3;">
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold; font-size: 18px;">FINAL SCORE</td>
            <td style="padding: 12px; border: 1px solid #ddd; text-align: center; font-size: 24px; font-weight: bold;">
              ${evaluation.final_score?.toFixed(1) || 'N/A'} / 10
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    ${
      evaluation.feedback
        ? `
    <div style="margin-bottom: 30px;">
      <h2 style="color: #05fcd3; margin-bottom: 15px; font-size: 24px;">Verbal Feedback</h2>
      <div style="padding: 15px; border: 2px solid #05fcd3; border-radius: 8px; background: #f0fffe; line-height: 1.6;">
        ${evaluation.feedback.replace(/\n/g, '<br>')}
      </div>
    </div>
    `
        : ''
    }

    ${
      evaluation.nonverbal_feedback
        ? `
    <div style="margin-bottom: 30px;">
      <h2 style="color: #7c3aed; margin-bottom: 15px; font-size: 24px;">Body Language & Interviewer Perspective</h2>
      <div style="padding: 15px; border: 2px solid #a78bfa; border-radius: 8px; background: #faf5ff; line-height: 1.6;">
        ${evaluation.nonverbal_feedback.replace(/\n/g, '<br>')}
      </div>
    </div>
    `
        : ''
    }

    <div style="margin-bottom: 30px; page-break-before: always;">
      <h2 style="color: #05fcd3; margin-bottom: 15px; font-size: 24px;">Interview Transcript</h2>
      ${qaList
        .map(
          (qa, index) => `
        <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; background: ${
          index % 2 === 0 ? '#f9f9f9' : 'white'
        };">
          <p style="margin: 0 0 10px 0; font-weight: bold; color: #05fcd3; font-size: 14px;">
            Question ${index + 1}:
          </p>
          <p style="margin: 0 0 15px 0; color: #333; line-height: 1.5;">
            ${qa.question}
          </p>
          <p style="margin: 0 0 5px 0; font-weight: bold; color: #666; font-size: 14px;">
            Answer:
          </p>
          <p style="margin: 0; color: #333; line-height: 1.5;">
            ${qa.answer}
          </p>
        </div>
      `
        )
        .join('')}
    </div>

    ${
      evaluation.raw_evaluation
        ? `
    <div style="margin-bottom: 30px; page-break-before: always;">
      <h2 style="color: #05fcd3; margin-bottom: 15px; font-size: 24px;">Detailed Evaluation</h2>
      <div style="padding: 15px; border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9; line-height: 1.6;">
        ${evaluation.raw_evaluation.replace(/\n/g, '<br>')}
      </div>
    </div>
    `
        : ''
    }

    <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #ddd; text-align: center; color: #666;">
      <p style="margin: 5px 0; font-size: 12px;">Generated by HireMate AI</p>
      <p style="margin: 5px 0; font-size: 12px;">Date: ${new Date().toLocaleString()}</p>
      <p style="margin: 5px 0; font-size: 12px; color: #05fcd3;">From Candidacy to Career</p>
    </div>
  `;

  doc.innerHTML = html;
  document.body.appendChild(doc);

  setTimeout(() => {
    window.print();
    document.body.removeChild(doc);
  }, 100);
};
